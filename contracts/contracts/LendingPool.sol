// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ILendingPool} from "./interfaces/ILendingPool.sol";

/// @title LendingPool
/// @notice ERC-4626 vault holding lender MockUSDC. Lender positions are pool shares
///         (cpUSDC); interest repaid by borrowers raises the share price and recorded
///         losses lower it.
/// @dev totalAssets() is derived from internal accounting (idle cash + outstanding
///      principal), not from the token balance, so direct token donations cannot
///      manipulate the share price. Withdrawals are limited to idle cash. Repayments
///      remain possible while the pool is paused so borrowers are never blocked from
///      settling a debt.
contract LendingPool is ILendingPool, ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Asset units held by the pool and available to lend or withdraw.
    uint256 public totalIdle;
    /// @notice Outstanding principal of disbursed loans.
    uint256 public totalBorrowed;
    uint256 public totalInterestEarned;
    uint256 public totalLosses;

    constructor(
        IERC20 asset_,
        address admin
    ) ERC20("Credora Pool Share", "cpUSDC") ERC4626(asset_) {
        if (address(asset_) == address(0) || admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // --------------------------------------------------------------------- lenders

    function deposit(uint256 assets, address receiver) public override whenNotPaused nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override whenNotPaused nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroAmount();
        return super.mint(shares, receiver);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override whenNotPaused nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        if (assets > totalIdle) revert InsufficientLiquidity(assets, totalIdle);
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override whenNotPaused nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroAmount();
        uint256 assets = previewRedeem(shares);
        if (assets > totalIdle) revert InsufficientLiquidity(assets, totalIdle);
        return super.redeem(shares, receiver, owner);
    }

    // ---------------------------------------------------------------- loan manager

    function disburse(
        uint256 loanId,
        address borrower,
        uint256 principal
    ) external onlyRole(LOAN_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (borrower == address(0)) revert ZeroAddress();
        if (principal == 0) revert ZeroAmount();
        if (principal > totalIdle) revert InsufficientLiquidity(principal, totalIdle);

        totalIdle -= principal;
        totalBorrowed += principal;
        IERC20(asset()).safeTransfer(borrower, principal);

        emit LoanDisbursed(loanId, borrower, principal, block.timestamp);
    }

    function collectRepayment(
        uint256 loanId,
        address payer,
        uint256 principal,
        uint256 interest
    ) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant {
        uint256 amount = principal + interest;
        if (amount == 0) revert ZeroAmount();
        if (principal > totalBorrowed) revert PrincipalExceedsBorrowed(principal, totalBorrowed);

        totalBorrowed -= principal;
        totalIdle += amount;
        totalInterestEarned += interest;
        IERC20(asset()).safeTransferFrom(payer, address(this), amount);

        emit RepaymentCollected(loanId, payer, principal, interest, block.timestamp);
    }

    function recordLoss(uint256 loanId, uint256 principalLoss) external onlyRole(LOAN_MANAGER_ROLE) {
        if (principalLoss == 0) revert ZeroAmount();
        if (principalLoss > totalBorrowed) revert PrincipalExceedsBorrowed(principalLoss, totalBorrowed);

        totalBorrowed -= principalLoss;
        totalLosses += principalLoss;

        emit LossRecorded(loanId, principalLoss, block.timestamp);
    }

    // ----------------------------------------------------------------------- admin

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Emergency recovery of tokens sent to the pool by mistake. For the pool
    ///         asset only the surplus above accounted idle cash can be recovered, so
    ///         lender funds can never be swept.
    function recoverTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (token == asset()) {
            uint256 surplus = IERC20(token).balanceOf(address(this)) - totalIdle;
            if (amount > surplus) revert RecoveryExceedsSurplus(amount, surplus);
        }
        IERC20(token).safeTransfer(to, amount);
        emit TokensRecovered(token, to, amount, block.timestamp);
    }

    // ----------------------------------------------------------------------- views

    function totalAssets() public view override returns (uint256) {
        return totalIdle + totalBorrowed;
    }

    function availableLiquidity() external view returns (uint256) {
        return totalIdle;
    }

    function utilizationBps() public view returns (uint256) {
        uint256 assets = totalAssets();
        return assets == 0 ? 0 : (totalBorrowed * BPS_DENOMINATOR) / assets;
    }

    /// @notice Single-call snapshot for dashboards.
    function poolSnapshot()
        external
        view
        returns (
            uint256 assets,
            uint256 idle,
            uint256 borrowed,
            uint256 interestEarned,
            uint256 losses,
            uint256 utilization,
            uint256 shares
        )
    {
        return (totalAssets(), totalIdle, totalBorrowed, totalInterestEarned, totalLosses, utilizationBps(), totalSupply());
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxDeposit(receiver);
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxMint(receiver);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 ownerAssets = previewRedeem(balanceOf(owner));
        return ownerAssets < totalIdle ? ownerAssets : totalIdle;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 ownerShares = balanceOf(owner);
        uint256 liquidShares = _convertToShares(totalIdle, Math.Rounding.Floor);
        return ownerShares < liquidShares ? ownerShares : liquidShares;
    }

    // -------------------------------------------------------------------- internal

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        totalIdle += assets;
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        totalIdle -= assets;
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
