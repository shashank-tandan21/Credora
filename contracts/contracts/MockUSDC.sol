// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Test-only ERC-20 stablecoin stand-in with 6 decimals. It has no value and
///         must never be deployed to a production network.
/// @dev Minting is restricted to MINTER_ROLE. A rate-limited public faucet lets testnet
///      users obtain demo balances without access to the minter key; the admin can
///      disable it at any time.
contract MockUSDC is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    uint256 public constant MAX_MINT_PER_CALL = 1_000_000 * 10 ** 6;

    bool public faucetEnabled;
    mapping(address account => uint256 timestamp) public lastFaucetClaim;

    event FaucetClaimed(address indexed account, uint256 amount, uint256 timestamp);
    event FaucetStatusChanged(bool enabled, uint256 timestamp);

    error ZeroAddress();
    error FaucetDisabled();
    error FaucetCooldownActive(uint256 availableAt);
    error MintAmountInvalid(uint256 amount);

    constructor(address admin, bool faucetEnabled_) ERC20("Mock USD Coin", "mUSDC") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        faucetEnabled = faucetEnabled_;
        emit FaucetStatusChanged(faucetEnabled_, block.timestamp);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint test tokens. Bounded per call to limit the impact of a leaked minter key.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > MAX_MINT_PER_CALL) revert MintAmountInvalid(amount);
        _mint(to, amount);
    }

    /// @notice Claim FAUCET_AMOUNT once per FAUCET_COOLDOWN.
    function faucet() external {
        if (!faucetEnabled) revert FaucetDisabled();
        uint256 lastClaim = lastFaucetClaim[msg.sender];
        if (lastClaim != 0 && block.timestamp < lastClaim + FAUCET_COOLDOWN) {
            revert FaucetCooldownActive(lastClaim + FAUCET_COOLDOWN);
        }
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    function setFaucetEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        faucetEnabled = enabled;
        emit FaucetStatusChanged(enabled, block.timestamp);
    }
}
