// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICreditScoreRegistry} from "./interfaces/ICreditScoreRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title CreditScoreRegistry
/// @notice Stores attester-signed academic credit scores with expiry and version.
/// @dev The newest attestation for a borrower is their current score. An attester may
///      never attest their own wallet. The DisputeManager may flag or revoke
///      attestations as the outcome of a dispute.
contract CreditScoreRegistry is ICreditScoreRegistry, AccessControl, Pausable {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");
    bytes32 public constant DISPUTE_MANAGER_ROLE = keccak256("DISPUTE_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant MAX_SCORE_BPS = 10_000;
    uint64 public constant MAX_VALIDITY = 365 days;

    IIdentityRegistry public immutable identityRegistry;

    mapping(bytes32 assessmentId => Attestation) private _attestations;
    mapping(address borrower => bytes32 assessmentId) public latestAssessmentId;
    mapping(address borrower => uint32 count) public attestationCount;

    constructor(address admin, IIdentityRegistry identityRegistry_) {
        if (admin == address(0) || address(identityRegistry_) == address(0)) revert ZeroAddress();
        identityRegistry = identityRegistry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Publish a score for a registered borrower.
    /// @param assessmentId Backend assessment UUID encoded as bytes32.
    /// @param scoreBps Score in basis points (0-10000).
    /// @param expiresAt Expiry timestamp, at most MAX_VALIDITY in the future.
    /// @param modelVersion Version of the documented academic scoring model.
    function attest(
        address borrower,
        bytes32 assessmentId,
        uint16 scoreBps,
        uint64 expiresAt,
        uint16 modelVersion
    ) external onlyRole(ATTESTER_ROLE) whenNotPaused {
        if (borrower == address(0)) revert ZeroAddress();
        if (borrower == msg.sender) revert SelfAttestation(msg.sender);
        if (assessmentId == bytes32(0)) revert InvalidAssessmentId();
        if (_attestations[assessmentId].status != AttestationStatus.None) revert AttestationExists(assessmentId);
        if (scoreBps > MAX_SCORE_BPS) revert ScoreOutOfRange(scoreBps);
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_VALIDITY) revert InvalidExpiry(expiresAt);
        if (!identityRegistry.isRegistered(borrower)) revert IdentityNotRegistered(borrower);

        uint32 version = attestationCount[borrower] + 1;
        attestationCount[borrower] = version;
        latestAssessmentId[borrower] = assessmentId;
        _attestations[assessmentId] = Attestation({
            borrower: borrower,
            scoreBps: scoreBps,
            modelVersion: modelVersion,
            version: version,
            status: AttestationStatus.Active,
            disputed: false,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            attester: msg.sender
        });

        emit ScoreAttested(borrower, assessmentId, msg.sender, scoreBps, version, modelVersion, expiresAt, block.timestamp);
    }

    function revoke(bytes32 assessmentId, bytes32 reasonHash) external onlyRole(ATTESTER_ROLE) {
        Attestation storage attestation = _activeAttestation(assessmentId);
        _revoke(assessmentId, attestation, reasonHash);
    }

    /// @notice Revoke an attestation because a dispute against it was upheld. Tolerates
    ///         attestations an attester already revoked while the dispute was open.
    function revokeDisputed(bytes32 assessmentId, bytes32 reasonHash) external onlyRole(DISPUTE_MANAGER_ROLE) {
        Attestation storage attestation = _existingAttestation(assessmentId);
        if (attestation.disputed) {
            attestation.disputed = false;
            emit ScoreDisputeFlagged(assessmentId, false, block.timestamp);
        }
        if (attestation.status == AttestationStatus.Active) {
            _revoke(assessmentId, attestation, reasonHash);
        }
    }

    function setDisputed(bytes32 assessmentId, bool disputed) external onlyRole(DISPUTE_MANAGER_ROLE) {
        Attestation storage attestation = _existingAttestation(assessmentId);
        attestation.disputed = disputed;
        emit ScoreDisputeFlagged(assessmentId, disputed, block.timestamp);
    }

    function getAttestation(bytes32 assessmentId) external view returns (Attestation memory) {
        return _attestations[assessmentId];
    }

    /// @notice Current score for `borrower`. `valid` requires an active, unexpired latest
    ///         attestation and a registered identity. Disputed scores remain valid until a
    ///         reviewer upholds the dispute.
    function currentScore(
        address borrower
    ) external view returns (uint16 scoreBps, uint64 expiresAt, bytes32 assessmentId, bool valid) {
        assessmentId = latestAssessmentId[borrower];
        Attestation storage attestation = _attestations[assessmentId];
        scoreBps = attestation.scoreBps;
        expiresAt = attestation.expiresAt;
        valid =
            attestation.status == AttestationStatus.Active &&
            expiresAt > block.timestamp &&
            identityRegistry.isRegistered(borrower);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _revoke(bytes32 assessmentId, Attestation storage attestation, bytes32 reasonHash) private {
        attestation.status = AttestationStatus.Revoked;
        emit ScoreRevoked(attestation.borrower, assessmentId, msg.sender, reasonHash, block.timestamp);
    }

    function _existingAttestation(bytes32 assessmentId) private view returns (Attestation storage attestation) {
        attestation = _attestations[assessmentId];
        if (attestation.status == AttestationStatus.None) revert AttestationNotFound(assessmentId);
    }

    function _activeAttestation(bytes32 assessmentId) private view returns (Attestation storage attestation) {
        attestation = _existingAttestation(assessmentId);
        if (attestation.status != AttestationStatus.Active) revert AttestationNotActive(assessmentId);
    }
}
