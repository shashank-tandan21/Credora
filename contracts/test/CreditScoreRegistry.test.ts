import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroHash } from "ethers";

import { DAY, ROLES } from "../scripts/lib/protocol.js";
import {
  as,
  ASSESSMENT_ID,
  attestScore,
  latestTimestamp,
  networkHelpers,
  PROFILE_HASH,
  protocolFixture,
  REASON_HASH,
  SCORE_BPS,
  SECOND_ASSESSMENT_ID,
} from "./helpers.js";

async function registeredBorrowerFixture() {
  const f = await protocolFixture();
  await as(f.identityRegistry, f.borrower).register(PROFILE_HASH);
  return f;
}

describe("CreditScoreRegistry", function () {
  it("stores an attestation and reports it as the current score", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    const expiresAt = (await latestTimestamp()) + 90n * DAY;

    await expect(as(f.creditScoreRegistry, f.operator).attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1))
      .to.emit(f.creditScoreRegistry, "ScoreAttested")
      .withArgs(f.borrower.address, ASSESSMENT_ID, f.operator.address, SCORE_BPS, 1n, 1n, expiresAt, anyValue);

    const [scoreBps, currentExpiry, assessmentId, valid] = await f.creditScoreRegistry.currentScore(f.borrower.address);
    expect(scoreBps).to.equal(BigInt(SCORE_BPS));
    expect(currentExpiry).to.equal(expiresAt);
    expect(assessmentId).to.equal(ASSESSMENT_ID);
    expect(valid).to.equal(true);

    const attestation = await f.creditScoreRegistry.getAttestation(ASSESSMENT_ID);
    expect(attestation.borrower).to.equal(f.borrower.address);
    expect(attestation.version).to.equal(1n);
    expect(attestation.attester).to.equal(f.operator.address);
  });

  it("restricts attestation to ATTESTER_ROLE", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    const expiresAt = (await latestTimestamp()) + DAY;
    await expect(as(f.creditScoreRegistry, f.outsider).attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "AccessControlUnauthorizedAccount")
      .withArgs(f.outsider.address, ROLES.ATTESTER);
  });

  it("validates borrower, identity, score range, expiry, and id uniqueness", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    const registry = as(f.creditScoreRegistry, f.operator);
    const now = await latestTimestamp();
    const expiresAt = now + 30n * DAY;

    await expect(registry.attest(f.outsider.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "IdentityNotRegistered")
      .withArgs(f.outsider.address);
    await expect(registry.attest(f.operator.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "SelfAttestation")
      .withArgs(f.operator.address);
    await expect(registry.attest(f.borrower.address, ZeroHash, SCORE_BPS, expiresAt, 1)).to.be.revertedWithCustomError(
      f.creditScoreRegistry,
      "InvalidAssessmentId",
    );
    await expect(registry.attest(f.borrower.address, ASSESSMENT_ID, 10_001, expiresAt, 1))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "ScoreOutOfRange")
      .withArgs(10_001n);
    await expect(registry.attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, now, 1)).to.be.revertedWithCustomError(
      f.creditScoreRegistry,
      "InvalidExpiry",
    );
    await expect(
      registry.attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, now + 400n * DAY, 1),
    ).to.be.revertedWithCustomError(f.creditScoreRegistry, "InvalidExpiry");

    await registry.attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1);
    await expect(registry.attest(f.borrower.address, ASSESSMENT_ID, SCORE_BPS, expiresAt, 1))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "AttestationExists")
      .withArgs(ASSESSMENT_ID);
  });

  it("treats expired attestations as invalid", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    const expiresAt = await attestScore(f, f.borrower, ASSESSMENT_ID, SCORE_BPS, DAY);
    await networkHelpers.time.increaseTo(expiresAt);
    const [, , , valid] = await f.creditScoreRegistry.currentScore(f.borrower.address);
    expect(valid).to.equal(false);
  });

  it("versions newer attestations and makes the latest current", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    await attestScore(f, f.borrower);
    await attestScore(f, f.borrower, SECOND_ASSESSMENT_ID, 8200);

    const [scoreBps, , assessmentId] = await f.creditScoreRegistry.currentScore(f.borrower.address);
    expect(scoreBps).to.equal(8200n);
    expect(assessmentId).to.equal(SECOND_ASSESSMENT_ID);
    expect((await f.creditScoreRegistry.getAttestation(SECOND_ASSESSMENT_ID)).version).to.equal(2n);
    expect(await f.creditScoreRegistry.attestationCount(f.borrower.address)).to.equal(2n);
  });

  it("revokes attestations and rejects unknown or inactive ids", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    await attestScore(f, f.borrower);
    const registry = as(f.creditScoreRegistry, f.operator);

    await expect(registry.revoke(ASSESSMENT_ID, REASON_HASH))
      .to.emit(f.creditScoreRegistry, "ScoreRevoked")
      .withArgs(f.borrower.address, ASSESSMENT_ID, f.operator.address, REASON_HASH, anyValue);
    const [, , , valid] = await f.creditScoreRegistry.currentScore(f.borrower.address);
    expect(valid).to.equal(false);

    await expect(registry.revoke(ASSESSMENT_ID, REASON_HASH))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "AttestationNotActive")
      .withArgs(ASSESSMENT_ID);
    await expect(registry.revoke(SECOND_ASSESSMENT_ID, REASON_HASH))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "AttestationNotFound")
      .withArgs(SECOND_ASSESSMENT_ID);
  });

  it("invalidates the score when the identity is revoked", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    await attestScore(f, f.borrower);
    await as(f.identityRegistry, f.operator).revoke(f.borrower.address, REASON_HASH);
    const [, , , valid] = await f.creditScoreRegistry.currentScore(f.borrower.address);
    expect(valid).to.equal(false);
  });

  it("restricts dispute flags to the DisputeManager role", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    await attestScore(f, f.borrower);
    await expect(as(f.creditScoreRegistry, f.operator).setDisputed(ASSESSMENT_ID, true))
      .to.be.revertedWithCustomError(f.creditScoreRegistry, "AccessControlUnauthorizedAccount")
      .withArgs(f.operator.address, ROLES.DISPUTE_MANAGER);
    await expect(as(f.creditScoreRegistry, f.operator).revokeDisputed(ASSESSMENT_ID, REASON_HASH)).to.be.revertedWithCustomError(
      f.creditScoreRegistry,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("blocks attestation while paused", async function () {
    const f = await networkHelpers.loadFixture(registeredBorrowerFixture);
    await as(f.creditScoreRegistry, f.admin).pause();
    await expect(attestScore(f, f.borrower)).to.be.revertedWithCustomError(f.creditScoreRegistry, "EnforcedPause");
  });
});
