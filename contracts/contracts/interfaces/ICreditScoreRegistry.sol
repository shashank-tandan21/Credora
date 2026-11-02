// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ICreditScoreRegistry
/// @notice Authorized, expiring attestations of the academic credit score.
/// @dev Scores are stored in basis points (0-10000), so the backend score `71.00`
///      is attested as `7100`. Each attestation is keyed by the backend assessment
///      UUID encoded as bytes32, which links on-chain and off-chain records.
interface ICreditScoreRegistry {
    enum AttestationStatus {
        None,
        Active,
        Revoked
    }

    struct Attestation {
        address borrower;
        uint16 scoreBps;
        uint16 modelVersion;
        uint32 version;
        AttestationStatus status;
        bool disputed;
        uint64 issuedAt;
        uint64 expiresAt;
        address attester;
    }

    event ScoreAttested(
        address indexed borrower,
        bytes32 indexed assessmentId,
        address indexed attester,
        uint16 scoreBps,
        uint32 version,
        uint16 modelVersion,
        uint64 expiresAt,
        uint256 timestamp
    );
    event ScoreRevoked(
        address indexed borrower,
        bytes32 indexed assessmentId,
        address indexed revokedBy,
        bytes32 reasonHash,
        uint256 timestamp
    );
    event ScoreDisputeFlagged(bytes32 indexed assessmentId, bool disputed, uint256 timestamp);

    error ZeroAddress();
    error InvalidAssessmentId();
    error AttestationExists(bytes32 assessmentId);
    error AttestationNotFound(bytes32 assessmentId);
    error AttestationNotActive(bytes32 assessmentId);
    error ScoreOutOfRange(uint16 scoreBps);
    error InvalidExpiry(uint64 expiresAt);
    error IdentityNotRegistered(address borrower);
    error SelfAttestation(address attester);

    function getAttestation(bytes32 assessmentId) external view returns (Attestation memory);

    function currentScore(
        address borrower
    ) external view returns (uint16 scoreBps, uint64 expiresAt, bytes32 assessmentId, bool valid);

    function setDisputed(bytes32 assessmentId, bool disputed) external;

    function revokeDisputed(bytes32 assessmentId, bytes32 reasonHash) external;
}
