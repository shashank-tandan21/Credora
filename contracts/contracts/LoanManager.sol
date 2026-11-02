// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICreditScoreRegistry} from "./interfaces/ICreditScoreRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ILendingPool} from "./interfaces/ILendingPool.sol";
import {ILoanManager} from "./interfaces/ILoanManager.sol";

/// @title LoanManager
/// @notice Owns the loan lifecycle and enforces eligibility against the identity and
///         credit-score registries. Funds move only through the LendingPool.
/// @dev Financial conventions (mirrored by the backend quote engine):
///      - interest = principal * annualRateBps * durationDays / (10000 * 365), rounded down
///      - installments = ceil(durationDays / 30); installment k is due at fundedAt + 30 days * k
///      - each installment is floor(totalDue / count); the final one absorbs the remainder
///      - repayments settle outstanding interest first, then principal
///      - installment k is past due once block.timestamp >= dueAt(k) + gracePeriod
///      - late payment carries no penalty interest; it makes the loan Overdue and
///        eligible for recovery
contract LoanManager is ILoanManager, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");
    bytes32 public constant RECOVERY_MANAGER_ROLE = keccak256("RECOVERY_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DAYS_PER_YEAR = 365;
    uint64 public constant INSTALLMENT_PERIOD = 30 days;
    uint32 public constant MIN_DURATION_DAYS = 30;
    uint32 public constant MAX_DURATION_DAYS = 365;
    uint16 public constant MAX_ANNUAL_RATE_BPS = 5_000;
    uint64 public constant MAX_RESTRUCTURE_HORIZON = 365 days;

    ILendingPool public immutable pool;
    ICreditScoreRegistry public immutable scoreRegistry;
    IIdentityRegistry public immutable identityRegistry;

    uint256 public nextLoanId = 1;

    LoanParameters private _parameters;
    mapping(uint256 loanId => Loan) private _loans;
    mapping(address borrower => uint256 loanId) public openLoanOf;
    mapping(address borrower => uint256[] loanIds) private _loansByBorrower;

    constructor(
        address admin,
        ILendingPool pool_,
        ICreditScoreRegistry scoreRegistry_,
        IIdentityRegistry identityRegistry_,
        LoanParameters memory parameters_
    ) {
        if (
            admin == address(0) ||
            address(pool_) == address(0) ||
            address(scoreRegistry_) == address(0) ||
            address(identityRegistry_) == address(0)
        ) revert ZeroAddress();
        _validateParameters(parameters_);

        pool = pool_;
        scoreRegistry = scoreRegistry_;
        identityRegistry = identityRegistry_;
        _parameters = parameters_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        emit LoanParametersUpdated(parameters_, block.timestamp);
    }

    // -------------------------------------------------------------------- borrower

    /// @notice Request a loan. When auto-funding is enabled and the pool has enough
    ///         idle liquidity the loan is funded and disbursed in the same transaction;
    ///         otherwise it stays Requested until a funder funds it or it expires.
    function requestLoan(uint256 principal, uint32 durationDays) external whenNotPaused nonReentrant returns (uint256 loanId) {
        address borrower = msg.sender;
        uint256 existing = openLoanOf[borrower];
        if (existing != 0) revert OpenLoanExists(borrower, existing);
        if (!identityRegistry.isRegistered(borrower)) revert IdentityNotRegistered(borrower);
        if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) revert InvalidDuration(durationDays);

        LoanParameters memory params = _parameters;
        if (principal < params.minPrincipal || principal > params.maxPrincipal) {
            revert PrincipalOutOfRange(principal, params.minPrincipal, params.maxPrincipal);
        }
        bytes32 assessmentId = _requireEligible(borrower, principal, params);

        loanId = nextLoanId++;
        Loan storage loan = _loans[loanId];
        loan.borrower = borrower;
        loan.status = LoanStatus.Requested;
        loan.annualRateBps = params.annualRateBps;
        loan.installmentCount = _installmentCount(durationDays);
        loan.durationDays = durationDays;
        loan.requestedAt = uint64(block.timestamp);
        loan.assessmentId = assessmentId;
        loan.principal = principal;
        loan.interest = _interest(principal, params.annualRateBps, durationDays);

        openLoanOf[borrower] = loanId;
        _loansByBorrower[borrower].push(loanId);

        emit LoanRequested(
            loanId,
            borrower,
            assessmentId,
            principal,
            loan.interest,
            durationDays,
            loan.installmentCount,
            block.timestamp
        );

        if (params.autoFund && pool.availableLiquidity() >= principal) {
            _fund(loanId, loan, address(this));
        }
    }

    /// @notice Cancel a Requested loan. The borrower may cancel at any time, a funder may
    ///         cancel at any time, and anyone may cancel an expired request.
    function cancelLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = _existingLoan(loanId);
        if (loan.status != LoanStatus.Requested) revert InvalidLoanStatus(loanId, loan.status);
        bool expired = block.timestamp > loan.requestedAt + _parameters.requestTtl;
        if (msg.sender != loan.borrower && !expired && !hasRole(FUNDER_ROLE, msg.sender)) {
            revert NotAuthorizedToCancel(loanId, msg.sender);
        }

        loan.status = LoanStatus.Cancelled;
        loan.closedAt = uint64(block.timestamp);
        delete openLoanOf[loan.borrower];

        emit LoanCancelled(loanId, loan.borrower, msg.sender, block.timestamp);
    }

    /// @notice Repay part or all of a loan. Anyone may repay on a borrower's behalf; the
    ///         payer must approve the LendingPool for `amount`. Allowed while paused.
    function repay(uint256 loanId, uint256 amount) public nonReentrant returns (uint256 remaining) {
        Loan storage loan = _existingLoan(loanId);
        LoanStatus status = loan.status;
        if (status != LoanStatus.Active && status != LoanStatus.Overdue && status != LoanStatus.Restructured) {
            revert InvalidLoanStatus(loanId, status);
        }
        if (amount == 0) revert ZeroAmount();
        uint256 outstandingBefore = _outstanding(loan);
        if (amount > outstandingBefore) revert RepaymentExceedsOutstanding(amount, outstandingBefore);

        uint256 interestDue = loan.interest - loan.interestRepaid;
        uint256 interestPortion = amount < interestDue ? amount : interestDue;
        uint256 principalPortion = amount - interestPortion;
        loan.interestRepaid += interestPortion;
        loan.principalRepaid += principalPortion;
        remaining = outstandingBefore - amount;

        bool cured;
        if (remaining == 0) {
            loan.status = LoanStatus.Repaid;
            loan.closedAt = uint64(block.timestamp);
            delete openLoanOf[loan.borrower];
        } else if (status == LoanStatus.Overdue && _amountPastDue(loan) == 0) {
            loan.status = loan.restructuredAt != 0 ? LoanStatus.Restructured : LoanStatus.Active;
            cured = true;
        }

        pool.collectRepayment(loanId, msg.sender, principalPortion, interestPortion);

        emit RepaymentMade(
            loanId,
            loan.borrower,
            msg.sender,
            amount,
            principalPortion,
            interestPortion,
            remaining,
            block.timestamp
        );
        if (remaining == 0) {
            emit LoanRepaid(loanId, loan.borrower, loan.principalRepaid + loan.interestRepaid, block.timestamp);
        } else if (cured) {
            emit LoanCured(loanId, loan.borrower, block.timestamp);
        }
    }

    function repayInFull(uint256 loanId) external returns (uint256) {
        return repay(loanId, _outstanding(_existingLoan(loanId)));
    }

    // ---------------------------------------------------------------- operations

    function fundLoan(uint256 loanId) external onlyRole(FUNDER_ROLE) whenNotPaused nonReentrant {
        _fund(loanId, _existingLoan(loanId), msg.sender);
    }

    /// @notice Mark a loan Overdue. Callable by anyone because the condition is derived
    ///         deterministically from the schedule, repayments, and block time.
    function markOverdue(uint256 loanId) external {
        Loan storage loan = _existingLoan(loanId);
        if (loan.status != LoanStatus.Active && loan.status != LoanStatus.Restructured) {
            revert InvalidLoanStatus(loanId, loan.status);
        }
        uint256 pastDue = _amountPastDue(loan);
        if (pastDue == 0) revert LoanNotOverdue(loanId);

        loan.status = LoanStatus.Overdue;
        emit LoanOverdue(loanId, loan.borrower, pastDue, block.timestamp);
    }

    /// @notice Write off an Overdue loan once `defaultAfter` has elapsed past its final due
    ///         date. Unrepaid principal is recorded as a pool loss.
    function markDefaulted(uint256 loanId) external onlyRole(FUNDER_ROLE) nonReentrant {
        Loan storage loan = _existingLoan(loanId);
        if (loan.status != LoanStatus.Overdue) revert InvalidLoanStatus(loanId, loan.status);
        uint64 eligibleAt = loan.finalDueAt + _parameters.defaultAfter;
        if (block.timestamp < eligibleAt) revert DefaultNotReached(loanId, eligibleAt);

        uint256 principalLoss = loan.principal - loan.principalRepaid;
        loan.status = LoanStatus.Defaulted;
        loan.closedAt = uint64(block.timestamp);
        delete openLoanOf[loan.borrower];

        if (principalLoss > 0) {
            pool.recordLoss(loanId, principalLoss);
        }
        emit LoanDefaulted(loanId, loan.borrower, principalLoss, block.timestamp);
    }

    /// @notice Apply an approved restructuring. Any increase of the outstanding balance is
    ///         booked as additional interest so `totalDue == principal + interest` holds.
    function restructure(
        uint256 loanId,
        uint256 newOutstanding,
        uint64 newFinalDueAt
    ) external onlyRole(RECOVERY_MANAGER_ROLE) nonReentrant {
        Loan storage loan = _existingLoan(loanId);
        if (!_isEligibleForRecovery(loan)) revert LoanNotOverdue(loanId);
        uint256 current = _outstanding(loan);
        if (newOutstanding < current) revert RestructureUnderpays(newOutstanding, current);
        if (newFinalDueAt <= block.timestamp || newFinalDueAt > block.timestamp + MAX_RESTRUCTURE_HORIZON) {
            revert InvalidDueDate(newFinalDueAt);
        }

        loan.interest += newOutstanding - current;
        loan.finalDueAt = newFinalDueAt;
        loan.restructuredAt = uint64(block.timestamp);
        loan.status = LoanStatus.Restructured;

        emit LoanRestructured(loanId, loan.borrower, current, newOutstanding, newFinalDueAt, block.timestamp);
    }

    // ----------------------------------------------------------------------- admin

    /// @notice Update risk parameters. The rate applies to new loans only; grace, request
    ///         TTL, and default delay also apply to existing loans.
    function setParameters(LoanParameters calldata parameters_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validateParameters(parameters_);
        _parameters = parameters_;
        emit LoanParametersUpdated(parameters_, block.timestamp);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ----------------------------------------------------------------------- views

    function parameters() external view returns (LoanParameters memory) {
        return _parameters;
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    function loansOf(address borrower) external view returns (uint256[] memory) {
        return _loansByBorrower[borrower];
    }

    function outstanding(uint256 loanId) external view returns (uint256) {
        Loan storage loan = _loans[loanId];
        return loan.status == LoanStatus.None ? 0 : _outstanding(loan);
    }

    function amountPastDue(uint256 loanId) external view returns (uint256) {
        return _amountPastDue(_loans[loanId]);
    }

    function isOverdue(uint256 loanId) external view returns (bool) {
        return _amountPastDue(_loans[loanId]) > 0;
    }

    function isEligibleForRecovery(uint256 loanId) external view returns (bool) {
        return _isEligibleForRecovery(_loans[loanId]);
    }

    /// @notice Next unpaid installment and the amount that clears it. Restructured loans
    ///         report installment 0, their final due date, and the full outstanding.
    function nextPaymentDue(
        uint256 loanId
    ) external view returns (uint16 installmentNumber, uint64 dueAt, uint256 amountDue) {
        Loan storage loan = _loans[loanId];
        if (!_isRepayable(loan.status)) return (0, 0, 0);
        uint256 repaid = loan.principalRepaid + loan.interestRepaid;
        uint256 totalDue = loan.principal + loan.interest;
        if (loan.restructuredAt != 0) return (0, loan.finalDueAt, totalDue - repaid);

        uint256 perInstallment = totalDue / loan.installmentCount;
        for (uint16 k = 1; k <= loan.installmentCount; k++) {
            uint256 cumulative = k == loan.installmentCount ? totalDue : perInstallment * k;
            if (cumulative > repaid) {
                return (k, loan.fundedAt + INSTALLMENT_PERIOD * k, cumulative - repaid);
            }
        }
        return (0, 0, 0);
    }

    /// @notice Quote a loan with the current parameters.
    function quote(
        uint256 principal,
        uint32 durationDays
    ) external view returns (uint256 interest, uint256 totalDue, uint16 installmentCount, uint256 installmentAmount) {
        if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) revert InvalidDuration(durationDays);
        interest = _interest(principal, _parameters.annualRateBps, durationDays);
        totalDue = principal + interest;
        installmentCount = _installmentCount(durationDays);
        installmentAmount = totalDue / installmentCount;
    }

    /// @notice Eligible limit for `borrower`: scoreBps * limitPerScoreBps, capped at maxPrincipal.
    function eligibility(
        address borrower
    ) external view returns (uint256 limit, uint16 scoreBps, bytes32 assessmentId, bool valid) {
        return _eligibility(borrower, _parameters);
    }

    // -------------------------------------------------------------------- internal

    function _fund(uint256 loanId, Loan storage loan, address fundedBy) private {
        if (loan.status != LoanStatus.Requested) revert InvalidLoanStatus(loanId, loan.status);
        uint64 expiresAt = loan.requestedAt + _parameters.requestTtl;
        if (block.timestamp > expiresAt) revert RequestExpired(loanId, expiresAt);
        if (!identityRegistry.isRegistered(loan.borrower)) revert IdentityNotRegistered(loan.borrower);
        _requireEligible(loan.borrower, loan.principal, _parameters);

        uint64 fundedAt = uint64(block.timestamp);
        loan.status = LoanStatus.Active;
        loan.fundedAt = fundedAt;
        loan.finalDueAt = fundedAt + INSTALLMENT_PERIOD * loan.installmentCount;

        pool.disburse(loanId, loan.borrower, loan.principal);

        emit LoanFunded(loanId, loan.borrower, fundedBy, loan.principal, loan.finalDueAt, block.timestamp);
    }

    function _requireEligible(
        address borrower,
        uint256 principal,
        LoanParameters memory params
    ) private view returns (bytes32 assessmentId) {
        uint256 limit;
        bool valid;
        (limit, , assessmentId, valid) = _eligibility(borrower, params);
        if (!valid) revert NoValidCreditScore(borrower);
        if (principal > limit) revert ExceedsEligibleLimit(principal, limit);
    }

    function _eligibility(
        address borrower,
        LoanParameters memory params
    ) private view returns (uint256 limit, uint16 scoreBps, bytes32 assessmentId, bool valid) {
        (scoreBps, , assessmentId, valid) = scoreRegistry.currentScore(borrower);
        if (!valid) return (0, scoreBps, assessmentId, false);
        limit = uint256(scoreBps) * params.limitPerScoreBps;
        if (limit > params.maxPrincipal) limit = params.maxPrincipal;
    }

    function _existingLoan(uint256 loanId) private view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
    }

    function _outstanding(Loan storage loan) private view returns (uint256) {
        return loan.principal + loan.interest - loan.principalRepaid - loan.interestRepaid;
    }

    function _requiredPaidBy(Loan storage loan, uint256 timestamp) private view returns (uint256) {
        uint256 grace = _parameters.gracePeriod;
        uint256 totalDue = loan.principal + loan.interest;
        if (loan.restructuredAt != 0) {
            return timestamp >= loan.finalDueAt + grace ? totalDue : 0;
        }
        if (timestamp < loan.fundedAt + grace + INSTALLMENT_PERIOD) return 0;
        uint256 elapsed = (timestamp - loan.fundedAt - grace) / INSTALLMENT_PERIOD;
        if (elapsed >= loan.installmentCount) return totalDue;
        return (totalDue / loan.installmentCount) * elapsed;
    }

    function _amountPastDue(Loan storage loan) private view returns (uint256) {
        if (!_isRepayable(loan.status)) return 0;
        uint256 required = _requiredPaidBy(loan, block.timestamp);
        uint256 repaid = loan.principalRepaid + loan.interestRepaid;
        return required > repaid ? required - repaid : 0;
    }

    function _isEligibleForRecovery(Loan storage loan) private view returns (bool) {
        if (loan.status == LoanStatus.Overdue) return true;
        return
            (loan.status == LoanStatus.Active || loan.status == LoanStatus.Restructured) &&
            _amountPastDue(loan) > 0;
    }

    function _isRepayable(LoanStatus status) private pure returns (bool) {
        return status == LoanStatus.Active || status == LoanStatus.Overdue || status == LoanStatus.Restructured;
    }

    function _interest(uint256 principal, uint16 annualRateBps, uint32 durationDays) private pure returns (uint256) {
        return (principal * annualRateBps * durationDays) / (BPS_DENOMINATOR * DAYS_PER_YEAR);
    }

    function _installmentCount(uint32 durationDays) private pure returns (uint16) {
        return uint16((durationDays + 29) / 30);
    }

    function _validateParameters(LoanParameters memory p) private pure {
        if (
            p.annualRateBps == 0 ||
            p.annualRateBps > MAX_ANNUAL_RATE_BPS ||
            p.limitPerScoreBps == 0 ||
            p.minPrincipal == 0 ||
            p.minPrincipal > p.maxPrincipal ||
            p.gracePeriod > 30 days ||
            p.requestTtl < 1 hours ||
            p.requestTtl > 30 days ||
            p.defaultAfter < 7 days ||
            p.defaultAfter > 365 days
        ) revert InvalidParameters();
    }
}
