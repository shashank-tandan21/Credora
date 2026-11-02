// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ILoanManager
/// @notice Loan lifecycle: request, fund/disburse, repay (full or partial), overdue,
///         restructure, cancel, and default.
/// @dev All amounts are MockUSDC smallest units (6 decimals). Rates are basis points.
interface ILoanManager {
    enum LoanStatus {
        None,
        Requested,
        Active,
        Overdue,
        Restructured,
        Repaid,
        Cancelled,
        Defaulted
    }

    struct Loan {
        address borrower;
        LoanStatus status;
        uint16 annualRateBps;
        uint16 installmentCount;
        uint32 durationDays;
        uint64 requestedAt;
        uint64 fundedAt;
        uint64 finalDueAt;
        uint64 restructuredAt;
        uint64 closedAt;
        bytes32 assessmentId;
        uint256 principal;
        uint256 interest;
        uint256 principalRepaid;
        uint256 interestRepaid;
    }

    struct LoanParameters {
        uint16 annualRateBps;
        uint64 gracePeriod;
        uint64 requestTtl;
        uint64 defaultAfter;
        bool autoFund;
        uint256 limitPerScoreBps;
        uint256 minPrincipal;
        uint256 maxPrincipal;
    }

    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        bytes32 indexed assessmentId,
        uint256 principal,
        uint256 interest,
        uint32 durationDays,
        uint16 installmentCount,
        uint256 timestamp
    );
    event LoanFunded(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed fundedBy,
        uint256 principal,
        uint64 finalDueAt,
        uint256 timestamp
    );
    event LoanCancelled(uint256 indexed loanId, address indexed borrower, address indexed cancelledBy, uint256 timestamp);
    event RepaymentMade(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed payer,
        uint256 amount,
        uint256 principalPortion,
        uint256 interestPortion,
        uint256 outstanding,
        uint256 timestamp
    );
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaid, uint256 timestamp);
    event LoanOverdue(uint256 indexed loanId, address indexed borrower, uint256 amountPastDue, uint256 timestamp);
    event LoanCured(uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event LoanRestructured(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 previousOutstanding,
        uint256 newOutstanding,
        uint64 newFinalDueAt,
        uint256 timestamp
    );
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 principalLoss, uint256 timestamp);
    event LoanParametersUpdated(LoanParameters parameters, uint256 timestamp);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidParameters();
    error LoanNotFound(uint256 loanId);
    error IdentityNotRegistered(address borrower);
    error NoValidCreditScore(address borrower);
    error OpenLoanExists(address borrower, uint256 loanId);
    error InvalidDuration(uint32 durationDays);
    error PrincipalOutOfRange(uint256 principal, uint256 minPrincipal, uint256 maxPrincipal);
    error ExceedsEligibleLimit(uint256 principal, uint256 eligibleLimit);
    error InvalidLoanStatus(uint256 loanId, LoanStatus status);
    error RequestExpired(uint256 loanId, uint64 expiredAt);
    error NotAuthorizedToCancel(uint256 loanId, address caller);
    error RepaymentExceedsOutstanding(uint256 amount, uint256 outstanding);
    error LoanNotOverdue(uint256 loanId);
    error DefaultNotReached(uint256 loanId, uint64 eligibleAt);
    error RestructureUnderpays(uint256 proposedOutstanding, uint256 currentOutstanding);
    error InvalidDueDate(uint64 dueAt);

    function getLoan(uint256 loanId) external view returns (Loan memory);

    function outstanding(uint256 loanId) external view returns (uint256);

    function isEligibleForRecovery(uint256 loanId) external view returns (bool);

    function restructure(uint256 loanId, uint256 newOutstanding, uint64 newFinalDueAt) external;
}
