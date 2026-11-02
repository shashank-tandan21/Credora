// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICreditScoreRegistry} from "./interfaces/ICreditScoreRegistry.sol";
import {IDisputeManager} from "./interfaces/IDisputeManager.sol";

/// @title DisputeManager
/// @notice Borrowers dispute their own active score attestation; reviewers resolve it.
/// @dev One open dispute per attestation. A reviewer can never resolve a dispute on
///      their own attestation. An upheld dispute revokes the attestation so a corrected
///      score must be re-attested; a rejected dispute clears the disputed flag. Notes
///      live off-chain and are referenced by hash for auditability.
contract DisputeManager is IDisputeManager, AccessControl, Pausable {
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    ICreditScoreRegistry public immutable scoreRegistry;

    uint256 public nextDisputeId = 1;

    mapping(uint256 disputeId => Dispute) private _disputes;
    mapping(bytes32 assessmentId => uint256 disputeId) public openDisputeOf;
    mapping(address borrower => uint256[] disputeIds) private _disputesByBorrower;

    constructor(address admin, ICreditScoreRegistry scoreRegistry_) {
        if (admin == address(0) || address(scoreRegistry_) == address(0)) revert ZeroAddress();
        scoreRegistry = scoreRegistry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function openDispute(bytes32 assessmentId, bytes32 reasonHash) external whenNotPaused returns (uint256 disputeId) {
        ICreditScoreRegistry.Attestation memory attestation = scoreRegistry.getAttestation(assessmentId);
        if (attestation.status != ICreditScoreRegistry.AttestationStatus.Active) revert AttestationNotActive(assessmentId);
        if (attestation.borrower != msg.sender) revert NotAttestationOwner(assessmentId, msg.sender);
        uint256 existing = openDisputeOf[assessmentId];
        if (existing != 0) revert DisputeAlreadyOpen(assessmentId, existing);
        if (reasonHash == bytes32(0)) revert InvalidReasonHash();

        disputeId = nextDisputeId++;
        _disputes[disputeId] = Dispute({
            assessmentId: assessmentId,
            borrower: msg.sender,
            status: DisputeStatus.Open,
            openedAt: uint64(block.timestamp),
            resolvedAt: 0,
            resolvedBy: address(0),
            reasonHash: reasonHash,
            resolutionHash: bytes32(0)
        });
        openDisputeOf[assessmentId] = disputeId;
        _disputesByBorrower[msg.sender].push(disputeId);

        scoreRegistry.setDisputed(assessmentId, true);
        emit DisputeOpened(disputeId, assessmentId, msg.sender, reasonHash, block.timestamp);
    }

    function withdrawDispute(uint256 disputeId) external {
        Dispute storage dispute = _openDispute(disputeId);
        if (dispute.borrower != msg.sender) revert NotDisputeBorrower(disputeId, msg.sender);

        dispute.status = DisputeStatus.Withdrawn;
        dispute.resolvedAt = uint64(block.timestamp);
        delete openDisputeOf[dispute.assessmentId];

        scoreRegistry.setDisputed(dispute.assessmentId, false);
        emit DisputeWithdrawn(disputeId, dispute.assessmentId, msg.sender, block.timestamp);
    }

    /// @param upheld True when the borrower's claim is accepted.
    /// @param resolutionHash Hash of the reviewer's off-chain resolution notes (required).
    function resolveDispute(
        uint256 disputeId,
        bool upheld,
        bytes32 resolutionHash
    ) external onlyRole(REVIEWER_ROLE) whenNotPaused {
        Dispute storage dispute = _openDispute(disputeId);
        if (dispute.borrower == msg.sender) revert ReviewerConflict(msg.sender);
        if (resolutionHash == bytes32(0)) revert InvalidResolutionHash();

        DisputeStatus outcome = upheld ? DisputeStatus.Upheld : DisputeStatus.Rejected;
        dispute.status = outcome;
        dispute.resolvedAt = uint64(block.timestamp);
        dispute.resolvedBy = msg.sender;
        dispute.resolutionHash = resolutionHash;
        delete openDisputeOf[dispute.assessmentId];

        if (upheld) {
            scoreRegistry.revokeDisputed(dispute.assessmentId, resolutionHash);
        } else {
            scoreRegistry.setDisputed(dispute.assessmentId, false);
        }
        emit DisputeResolved(disputeId, dispute.assessmentId, msg.sender, outcome, resolutionHash, block.timestamp);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return _disputes[disputeId];
    }

    function disputesOf(address borrower) external view returns (uint256[] memory) {
        return _disputesByBorrower[borrower];
    }

    function _openDispute(uint256 disputeId) private view returns (Dispute storage dispute) {
        dispute = _disputes[disputeId];
        if (dispute.status == DisputeStatus.None) revert DisputeNotFound(disputeId);
        if (dispute.status != DisputeStatus.Open) revert DisputeNotOpen(disputeId, dispute.status);
    }
}
