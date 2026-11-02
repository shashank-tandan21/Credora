// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice Borrowers self-register their wallet with a hash of their off-chain profile.
///         Registrars may revoke and reinstate identities.
contract IdentityRegistry is IIdentityRegistry, AccessControl, Pausable {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public totalRegistered;

    mapping(address wallet => Identity) private _identities;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Register the caller's wallet. `profileHash` is keccak256 of the backend
    ///         borrower profile identifier, never raw personal data.
    function register(bytes32 profileHash) external whenNotPaused {
        if (profileHash == bytes32(0)) revert InvalidProfileHash();
        Identity storage identity = _identities[msg.sender];
        if (identity.status == IdentityStatus.Registered) revert AlreadyRegistered(msg.sender);
        if (identity.status == IdentityStatus.Revoked) revert IdentityIsRevoked(msg.sender);

        identity.status = IdentityStatus.Registered;
        identity.profileHash = profileHash;
        identity.registeredAt = uint64(block.timestamp);
        identity.updatedAt = uint64(block.timestamp);
        totalRegistered += 1;

        emit IdentityRegistered(msg.sender, profileHash, block.timestamp);
    }

    function updateProfile(bytes32 profileHash) external whenNotPaused {
        if (profileHash == bytes32(0)) revert InvalidProfileHash();
        Identity storage identity = _identities[msg.sender];
        if (identity.status != IdentityStatus.Registered) revert NotRegistered(msg.sender);

        identity.profileHash = profileHash;
        identity.updatedAt = uint64(block.timestamp);

        emit IdentityProfileUpdated(msg.sender, profileHash, block.timestamp);
    }

    function revoke(address wallet, bytes32 reasonHash) external onlyRole(REGISTRAR_ROLE) {
        Identity storage identity = _identities[wallet];
        if (identity.status != IdentityStatus.Registered) revert NotRegistered(wallet);

        identity.status = IdentityStatus.Revoked;
        identity.updatedAt = uint64(block.timestamp);
        totalRegistered -= 1;

        emit IdentityRevoked(wallet, msg.sender, reasonHash, block.timestamp);
    }

    function reinstate(address wallet) external onlyRole(REGISTRAR_ROLE) {
        Identity storage identity = _identities[wallet];
        if (identity.status != IdentityStatus.Revoked) revert IdentityNotRevoked(wallet);

        identity.status = IdentityStatus.Registered;
        identity.updatedAt = uint64(block.timestamp);
        totalRegistered += 1;

        emit IdentityReinstated(wallet, msg.sender, block.timestamp);
    }

    function isRegistered(address wallet) external view returns (bool) {
        return _identities[wallet].status == IdentityStatus.Registered;
    }

    function getIdentity(address wallet) external view returns (Identity memory) {
        return _identities[wallet];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
