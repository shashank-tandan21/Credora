import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroHash } from "ethers";

import { hashText, ROLES } from "../scripts/lib/protocol.js";
import { as, networkHelpers, PROFILE_HASH, protocolFixture, REASON_HASH } from "./helpers.js";

describe("IdentityRegistry", function () {
  it("registers a wallet with a profile hash", async function () {
    const { identityRegistry, borrower } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(identityRegistry, borrower).register(PROFILE_HASH))
      .to.emit(identityRegistry, "IdentityRegistered")
      .withArgs(borrower.address, PROFILE_HASH, anyValue);

    expect(await identityRegistry.isRegistered(borrower.address)).to.equal(true);
    expect(await identityRegistry.totalRegistered()).to.equal(1n);
    const identity = await identityRegistry.getIdentity(borrower.address);
    expect(identity.status).to.equal(1n);
    expect(identity.profileHash).to.equal(PROFILE_HASH);
  });

  it("rejects duplicate registration and empty profile hashes", async function () {
    const { identityRegistry, borrower } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(identityRegistry, borrower).register(ZeroHash)).to.be.revertedWithCustomError(
      identityRegistry,
      "InvalidProfileHash",
    );
    await as(identityRegistry, borrower).register(PROFILE_HASH);
    await expect(as(identityRegistry, borrower).register(PROFILE_HASH))
      .to.be.revertedWithCustomError(identityRegistry, "AlreadyRegistered")
      .withArgs(borrower.address);
  });

  it("updates the profile hash only for registered wallets", async function () {
    const { identityRegistry, borrower, outsider } = await networkHelpers.loadFixture(protocolFixture);
    const nextHash = hashText("updated-profile");
    await expect(as(identityRegistry, outsider).updateProfile(nextHash))
      .to.be.revertedWithCustomError(identityRegistry, "NotRegistered")
      .withArgs(outsider.address);

    await as(identityRegistry, borrower).register(PROFILE_HASH);
    await expect(as(identityRegistry, borrower).updateProfile(nextHash))
      .to.emit(identityRegistry, "IdentityProfileUpdated")
      .withArgs(borrower.address, nextHash, anyValue);
  });

  it("lets registrars revoke and reinstate identities", async function () {
    const { identityRegistry, borrower, operator } = await networkHelpers.loadFixture(protocolFixture);
    await as(identityRegistry, borrower).register(PROFILE_HASH);

    await expect(as(identityRegistry, operator).revoke(borrower.address, REASON_HASH))
      .to.emit(identityRegistry, "IdentityRevoked")
      .withArgs(borrower.address, operator.address, REASON_HASH, anyValue);
    expect(await identityRegistry.isRegistered(borrower.address)).to.equal(false);
    expect(await identityRegistry.totalRegistered()).to.equal(0n);

    await expect(as(identityRegistry, borrower).register(PROFILE_HASH))
      .to.be.revertedWithCustomError(identityRegistry, "IdentityIsRevoked")
      .withArgs(borrower.address);

    await expect(as(identityRegistry, operator).reinstate(borrower.address))
      .to.emit(identityRegistry, "IdentityReinstated")
      .withArgs(borrower.address, operator.address, anyValue);
    expect(await identityRegistry.isRegistered(borrower.address)).to.equal(true);
    await expect(as(identityRegistry, operator).reinstate(borrower.address)).to.be.revertedWithCustomError(
      identityRegistry,
      "IdentityNotRevoked",
    );
  });

  it("restricts revocation to REGISTRAR_ROLE", async function () {
    const { identityRegistry, borrower, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await as(identityRegistry, borrower).register(PROFILE_HASH);
    await expect(as(identityRegistry, outsider).revoke(borrower.address, REASON_HASH))
      .to.be.revertedWithCustomError(identityRegistry, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, ROLES.REGISTRAR);
  });

  it("blocks registration while paused", async function () {
    const { identityRegistry, admin, borrower, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(identityRegistry, outsider).pause()).to.be.revertedWithCustomError(
      identityRegistry,
      "AccessControlUnauthorizedAccount",
    );
    await as(identityRegistry, admin).pause();
    await expect(as(identityRegistry, borrower).register(PROFILE_HASH)).to.be.revertedWithCustomError(
      identityRegistry,
      "EnforcedPause",
    );
    await as(identityRegistry, admin).unpause();
    await as(identityRegistry, borrower).register(PROFILE_HASH);
  });
});
