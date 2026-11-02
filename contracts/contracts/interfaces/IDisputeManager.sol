// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IDisputeManager
/// @notice Borrower disputes against their own score attestations, resolved by reviewers.
interface IDisputeManager {
    enum DisputeStatus {
        None,
        Open,
        Upheld,
        Rejected,
        Withdrawn
    }

    struct Dispute {
        bytes32 assessmentId;
        address borrower;
        DisputeStatus status;
        uint64 openedAt;
        uint64 resolvedAt;
        address resolvedBy;
        bytes32 reasonHash;
        bytes32 resolutionHash;
    }

    event DisputeOpened(
        uint256 indexed disputeId,
        bytes32 indexed assessmentId,
        address indexed borrower,
        bytes32 reasonHash,
        uint256 timestamp
    );
    event DisputeWithdrawn(uint256 indexed disputeId, bytes32 indexed assessmentId, address indexed borrower, uint256 timestamp);
    event DisputeResolved(
        uint256 indexed disputeId,
        bytes32 indexed assessmentId,
        address indexed reviewer,
        DisputeStatus outcome,
        bytes32 resolutionHash,
        uint256 timestamp
    );

    error ZeroAddress();
    error InvalidReasonHash();
    error InvalidResolutionHash();
    error DisputeNotFound(uint256 disputeId);
    error NotAttestationOwner(bytes32 assessmentId, address caller);
    error AttestationNotActive(bytes32 assessmentId);
    error DisputeAlreadyOpen(bytes32 assessmentId, uint256 disputeId);
    error DisputeNotOpen(uint256 disputeId, DisputeStatus status);
    error NotDisputeBorrower(uint256 disputeId, address caller);
    error ReviewerConflict(address reviewer);
}
