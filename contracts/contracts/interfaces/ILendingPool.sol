// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ILendingPool
/// @notice Loan-facing surface of the ERC-4626 lending pool. Lender deposits and
///         withdrawals use the standard ERC-4626 functions and events.
interface ILendingPool {
    event LoanDisbursed(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 timestamp);
    event RepaymentCollected(
        uint256 indexed loanId,
        address indexed payer,
        uint256 principal,
        uint256 interest,
        uint256 timestamp
    );
    event LossRecorded(uint256 indexed loanId, uint256 principalLoss, uint256 timestamp);
    event TokensRecovered(address indexed token, address indexed to, uint256 amount, uint256 timestamp);

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error PrincipalExceedsBorrowed(uint256 principal, uint256 borrowed);
    error RecoveryExceedsSurplus(uint256 requested, uint256 surplus);

    function disburse(uint256 loanId, address borrower, uint256 principal) external;

    function collectRepayment(uint256 loanId, address payer, uint256 principal, uint256 interest) external;

    function recordLoss(uint256 loanId, uint256 principalLoss) external;

    function availableLiquidity() external view returns (uint256);

    function totalBorrowed() external view returns (uint256);
}
