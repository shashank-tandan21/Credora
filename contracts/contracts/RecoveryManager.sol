// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ILoanManager} from "./interfaces/ILoanManager.sol";
import {IRecoveryManager} from "./interfaces/IRecoveryManager.sol";

/// @title RecoveryManager
/// @notice Borrowers of overdue loans propose a restructuring; recovery officers approve
///         it with a milestone schedule that is applied to the loan. Milestone
///         completion is derived from repayments made after approval, so progress is
///         deterministic and cannot be self-reported.
contract RecoveryManager is IRecoveryManager, AccessControl, Pausable {
    bytes32 public constant RECOVERY_OFFICER_ROLE = keccak256("RECOVERY_OFFICER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant MAX_MILESTONES = 12;
    uint64 public constant MAX_PLAN_HORIZON = 365 days;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    ILoanManager public immutable loanManager;

    uint256 public nextRequestId = 1;

    mapping(uint256 requestId => RecoveryRequest) private _requests;
    mapping(uint256 requestId => Milestone[]) private _milestones;
    mapping(uint256 loanId => uint256 requestId) public openRequestOf;

    constructor(address admin, ILoanManager loanManager_) {
        if (admin == address(0) || address(loanManager_) == address(0)) revert ZeroAddress();
        loanManager = loanManager_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // -------------------------------------------------------------------- borrower

    function submitRequest(
        uint256 loanId,
        uint256 proposedOutstanding,
        uint64 proposedFinalDueAt,
        bytes32 reasonHash
    ) external whenNotPaused returns (uint256 requestId) {
        ILoanManager.Loan memory loan = loanManager.getLoan(loanId);
        if (loan.borrower != msg.sender) revert NotLoanBorrower(loanId, msg.sender);
        if (!loanManager.isEligibleForRecovery(loanId)) revert LoanNotEligible(loanId);
        uint256 existing = openRequestOf[loanId];
        if (existing != 0) revert RequestAlreadyOpen(loanId, existing);
        uint256 current = loanManager.outstanding(loanId);
        if (proposedOutstanding < current) revert ProposalUnderpays(proposedOutstanding, current);
        _validateDueDate(proposedFinalDueAt);
        if (reasonHash == bytes32(0)) revert InvalidReasonHash();

        requestId = nextRequestId++;
        RecoveryRequest storage request = _requests[requestId];
        request.loanId = loanId;
        request.borrower = msg.sender;
        request.status = RequestStatus.Submitted;
        request.proposedOutstanding = proposedOutstanding;
        request.proposedFinalDueAt = proposedFinalDueAt;
        request.submittedAt = uint64(block.timestamp);
        request.reasonHash = reasonHash;
        openRequestOf[loanId] = requestId;

        emit RecoveryRequested(
            requestId,
            loanId,
            msg.sender,
            proposedOutstanding,
            proposedFinalDueAt,
            reasonHash,
            block.timestamp
        );
    }

    function cancelRequest(uint256 requestId) external {
        RecoveryRequest storage request = _existingRequest(requestId);
        if (request.borrower != msg.sender) revert NotLoanBorrower(request.loanId, msg.sender);
        _requireStatus(requestId, request, RequestStatus.Submitted);

        request.status = RequestStatus.Cancelled;
        request.decidedAt = uint64(block.timestamp);
        delete openRequestOf[request.loanId];

        emit RecoveryCancelled(requestId, request.loanId, msg.sender, block.timestamp);
    }

    // --------------------------------------------------------------------- officer

    function rejectRequest(uint256 requestId, bytes32 decisionHash) external onlyRole(RECOVERY_OFFICER_ROLE) {
        RecoveryRequest storage request = _existingRequest(requestId);
        _requireStatus(requestId, request, RequestStatus.Submitted);
        if (request.borrower == msg.sender) revert OfficerConflict(msg.sender);
        if (decisionHash == bytes32(0)) revert InvalidReasonHash();

        request.status = RequestStatus.Rejected;
        request.decidedAt = uint64(block.timestamp);
        request.decidedBy = msg.sender;
        request.decisionHash = decisionHash;
        delete openRequestOf[request.loanId];

        emit RecoveryRejected(requestId, request.loanId, msg.sender, decisionHash, block.timestamp);
    }

    /// @notice Approve a request with an explicit milestone schedule. The milestone total
    ///         becomes the loan's new outstanding balance and the last milestone date its
    ///         new final due date. The total may not underpay the current outstanding.
    function approveRequest(
        uint256 requestId,
        uint256[] calldata amounts,
        uint64[] calldata dueDates,
        bytes32 decisionHash
    ) external onlyRole(RECOVERY_OFFICER_ROLE) whenNotPaused {
        RecoveryRequest storage request = _existingRequest(requestId);
        _requireStatus(requestId, request, RequestStatus.Submitted);
        if (request.borrower == msg.sender) revert OfficerConflict(msg.sender);
        if (decisionHash == bytes32(0)) revert InvalidReasonHash();
        uint256 count = amounts.length;
        if (count == 0 || count > MAX_MILESTONES || count != dueDates.length) revert InvalidMilestones();

        uint256 total;
        uint64 previousDueAt = uint64(block.timestamp);
        Milestone[] storage milestones = _milestones[requestId];
        for (uint256 i = 0; i < count; i++) {
            if (amounts[i] == 0 || dueDates[i] <= previousDueAt) revert InvalidMilestones();
            total += amounts[i];
            previousDueAt = dueDates[i];
            milestones.push(Milestone({amount: amounts[i], dueAt: dueDates[i], completedAt: 0}));
            emit MilestoneScheduled(requestId, uint16(i), amounts[i], dueDates[i]);
        }
        _validateDueDate(previousDueAt);

        ILoanManager.Loan memory loan = loanManager.getLoan(request.loanId);
        request.status = RequestStatus.Approved;
        request.milestoneCount = uint16(count);
        request.approvedOutstanding = total;
        request.baselineRepaid = loan.principalRepaid + loan.interestRepaid;
        request.decidedAt = uint64(block.timestamp);
        request.decidedBy = msg.sender;
        request.decisionHash = decisionHash;

        loanManager.restructure(request.loanId, total, previousDueAt);

        emit RecoveryApproved(requestId, request.loanId, msg.sender, total, uint16(count), decisionHash, block.timestamp);
    }

    // ------------------------------------------------------------------ milestones

    /// @notice Mark the next milestone complete once repayments since approval cover the
    ///         cumulative milestone amount. Callable by anyone; milestones complete in order.
    function completeMilestone(uint256 requestId, uint16 index) external {
        RecoveryRequest storage request = _existingRequest(requestId);
        _requireStatus(requestId, request, RequestStatus.Approved);
        if (index != request.milestonesCompleted) revert MilestoneOutOfOrder(request.milestonesCompleted, index);

        Milestone[] storage milestones = _milestones[requestId];
        uint256 required;
        for (uint256 i = 0; i <= index; i++) {
            required += milestones[i].amount;
        }
        uint256 paid = _paidSinceApproval(request);
        if (paid < required) revert MilestoneNotFunded(required, paid);

        milestones[index].completedAt = uint64(block.timestamp);
        request.milestonesCompleted = index + 1;
        emit MilestoneCompleted(requestId, index, paid, block.timestamp);

        if (request.milestonesCompleted == request.milestoneCount) {
            request.status = RequestStatus.Completed;
            delete openRequestOf[request.loanId];
            emit RecoveryCompleted(requestId, request.loanId, request.borrower, block.timestamp);
        }
    }

    // ----------------------------------------------------------------------- admin

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ----------------------------------------------------------------------- views

    function getRequest(uint256 requestId) external view returns (RecoveryRequest memory) {
        return _requests[requestId];
    }

    function getMilestones(uint256 requestId) external view returns (Milestone[] memory) {
        return _milestones[requestId];
    }

    /// @notice Completed milestones as basis points of the schedule.
    function progressBps(uint256 requestId) external view returns (uint256) {
        RecoveryRequest storage request = _requests[requestId];
        if (request.milestoneCount == 0) return 0;
        return (uint256(request.milestonesCompleted) * BPS_DENOMINATOR) / request.milestoneCount;
    }

    function isMilestoneLate(uint256 requestId, uint16 index) external view returns (bool) {
        Milestone[] storage milestones = _milestones[requestId];
        if (index >= milestones.length) return false;
        Milestone storage milestone = milestones[index];
        return milestone.completedAt == 0 && block.timestamp > milestone.dueAt;
    }

    // -------------------------------------------------------------------- internal

    function _paidSinceApproval(RecoveryRequest storage request) private view returns (uint256) {
        ILoanManager.Loan memory loan = loanManager.getLoan(request.loanId);
        return loan.principalRepaid + loan.interestRepaid - request.baselineRepaid;
    }

    function _existingRequest(uint256 requestId) private view returns (RecoveryRequest storage request) {
        request = _requests[requestId];
        if (request.status == RequestStatus.None) revert RequestNotFound(requestId);
    }

    function _requireStatus(uint256 requestId, RecoveryRequest storage request, RequestStatus expected) private view {
        if (request.status != expected) revert InvalidRequestStatus(requestId, request.status);
    }

    function _validateDueDate(uint64 dueAt) private view {
        if (dueAt <= block.timestamp || dueAt > block.timestamp + MAX_PLAN_HORIZON) revert InvalidDueDate(dueAt);
    }
}
