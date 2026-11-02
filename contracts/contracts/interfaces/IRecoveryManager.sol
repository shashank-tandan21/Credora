// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IRecoveryManager
/// @notice Overdue-loan restructuring requests and repayment milestones.
interface IRecoveryManager {
    enum RequestStatus {
        None,
        Submitted,
        Approved,
        Rejected,
        Cancelled,
        Completed
    }

    struct RecoveryRequest {
        uint256 loanId;
        address borrower;
        RequestStatus status;
        uint16 milestoneCount;
        uint16 milestonesCompleted;
        uint64 proposedFinalDueAt;
        uint64 submittedAt;
        uint64 decidedAt;
        address decidedBy;
        uint256 proposedOutstanding;
        uint256 approvedOutstanding;
        uint256 baselineRepaid;
        bytes32 reasonHash;
        bytes32 decisionHash;
    }

    struct Milestone {
        uint256 amount;
        uint64 dueAt;
        uint64 completedAt;
    }

    event RecoveryRequested(
        uint256 indexed requestId,
        uint256 indexed loanId,
        address indexed borrower,
        uint256 proposedOutstanding,
        uint64 proposedFinalDueAt,
        bytes32 reasonHash,
        uint256 timestamp
    );
    event RecoveryCancelled(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event RecoveryRejected(
        uint256 indexed requestId,
        uint256 indexed loanId,
        address indexed officer,
        bytes32 decisionHash,
        uint256 timestamp
    );
    event RecoveryApproved(
        uint256 indexed requestId,
        uint256 indexed loanId,
        address indexed officer,
        uint256 approvedOutstanding,
        uint16 milestoneCount,
        bytes32 decisionHash,
        uint256 timestamp
    );
    event MilestoneScheduled(uint256 indexed requestId, uint16 indexed index, uint256 amount, uint64 dueAt);
    event MilestoneCompleted(uint256 indexed requestId, uint16 indexed index, uint256 cumulativePaid, uint256 timestamp);
    event RecoveryCompleted(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower, uint256 timestamp);

    error ZeroAddress();
    error InvalidReasonHash();
    error RequestNotFound(uint256 requestId);
    error NotLoanBorrower(uint256 loanId, address caller);
    error LoanNotEligible(uint256 loanId);
    error RequestAlreadyOpen(uint256 loanId, uint256 requestId);
    error ProposalUnderpays(uint256 proposedOutstanding, uint256 currentOutstanding);
    error InvalidDueDate(uint64 dueAt);
    error InvalidRequestStatus(uint256 requestId, RequestStatus status);
    error InvalidMilestones();
    error OfficerConflict(address officer);
    error MilestoneOutOfOrder(uint16 expectedIndex, uint16 providedIndex);
    error MilestoneNotFunded(uint256 requiredCumulative, uint256 paidSinceApproval);
}
