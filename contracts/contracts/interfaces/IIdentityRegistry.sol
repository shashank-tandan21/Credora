// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IIdentityRegistry
/// @notice Wallet identity boundary for REBOUND borrowers.
/// @dev Only a hash of the off-chain borrower profile is stored on-chain. No personal
///      data is ever written to the chain.
interface IIdentityRegistry {
    enum IdentityStatus {
        None,
        Registered,
        Revoked
    }

    struct Identity {
        IdentityStatus status;
        bytes32 profileHash;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    event IdentityRegistered(address indexed wallet, bytes32 indexed profileHash, uint256 timestamp);
    event IdentityProfileUpdated(address indexed wallet, bytes32 indexed profileHash, uint256 timestamp);
    event IdentityRevoked(
        address indexed wallet,
        address indexed registrar,
        bytes32 reasonHash,
        uint256 timestamp
    );
    event IdentityReinstated(address indexed wallet, address indexed registrar, uint256 timestamp);

    error ZeroAddress();
    error InvalidProfileHash();
    error AlreadyRegistered(address wallet);
    error NotRegistered(address wallet);
    error IdentityIsRevoked(address wallet);
    error IdentityNotRevoked(address wallet);

    function register(bytes32 profileHash) external;

    function updateProfile(bytes32 profileHash) external;

    function isRegistered(address wallet) external view returns (bool);

    function getIdentity(address wallet) external view returns (Identity memory);
}
