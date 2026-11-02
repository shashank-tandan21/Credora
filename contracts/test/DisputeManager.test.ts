import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroHash } from "ethers";

import { ROLES, usdc } from "../scripts/lib/protocol.js";
import {
  as,
  ASSESSMENT_ID,
  eligibleBorrowerFixture,
  networkHelpers,
  REASON_HASH,
  RESOLUTION_HASH,
  SECOND_ASSESSMENT_ID,
} from "./helpers.js";

const DisputeStatus = { Open: 1n, Upheld: 2n, Rejected: 3n, Withdrawn: 4n } as const;

async function openDisputeFixture() {
  const f = await eligibleBorrowerFixture();
  await as(f.disputeManager, f.borrower).openDispute(ASSESSMENT_ID, REASON_HASH);
  return { ...f, disputeId: 1n };
}

describe("DisputeManager", function () {
  describe("opening disputes", function () {
    it("opens a dispute on the borrower's own attestation and flags it", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await expect(as(f.disputeManager, f.borrower).openDispute(ASSESSMENT_ID, REASON_HASH))
        .to.emit(f.disputeManager, "DisputeOpened")
        .withArgs(1n, ASSESSMENT_ID, f.borrower.address, REASON_HASH, anyValue);

      expect((await f.creditScoreRegistry.getAttestation(ASSESSMENT_ID)).disputed).to.equal(true);
      expect(await f.disputeManager.openDisputeOf(ASSESSMENT_ID)).to.equal(1n);
      expect(await f.disputeManager.disputesOf(f.borrower.address)).to.deep.equal([1n]);
      const dispute = await f.disputeManager.getDispute(1n);
      expect(dispute.status).to.equal(DisputeStatus.Open);
    });

    it("keeps a disputed score usable until a reviewer upholds the dispute", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await expect(as(f.loanManager, f.borrower).requestLoan(usdc(100), 30)).to.emit(f.loanManager, "LoanFunded");
    });

    it("rejects disputes on attestations the caller does not own or that are inactive", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await expect(as(f.disputeManager, f.other).openDispute(ASSESSMENT_ID, REASON_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "NotAttestationOwner")
        .withArgs(ASSESSMENT_ID, f.other.address);
      await expect(as(f.disputeManager, f.borrower).openDispute(SECOND_ASSESSMENT_ID, REASON_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "AttestationNotActive")
        .withArgs(SECOND_ASSESSMENT_ID);
      await expect(as(f.disputeManager, f.borrower).openDispute(ASSESSMENT_ID, ZeroHash)).to.be.revertedWithCustomError(
        f.disputeManager,
        "InvalidReasonHash",
      );
    });

    it("allows one open dispute per attestation", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await expect(as(f.disputeManager, f.borrower).openDispute(ASSESSMENT_ID, REASON_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "DisputeAlreadyOpen")
        .withArgs(ASSESSMENT_ID, f.disputeId);
    });

    it("lets only the borrower withdraw an open dispute", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await expect(as(f.disputeManager, f.other).withdrawDispute(f.disputeId))
        .to.be.revertedWithCustomError(f.disputeManager, "NotDisputeBorrower")
        .withArgs(f.disputeId, f.other.address);
      await expect(as(f.disputeManager, f.borrower).withdrawDispute(f.disputeId))
        .to.emit(f.disputeManager, "DisputeWithdrawn")
        .withArgs(f.disputeId, ASSESSMENT_ID, f.borrower.address, anyValue);
      expect((await f.creditScoreRegistry.getAttestation(ASSESSMENT_ID)).disputed).to.equal(false);
      expect(await f.disputeManager.openDisputeOf(ASSESSMENT_ID)).to.equal(0n);
    });
  });

  describe("reviewer resolution", function () {
    it("rejects a claim and clears the disputed flag", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await expect(as(f.disputeManager, f.operator).resolveDispute(f.disputeId, false, RESOLUTION_HASH))
        .to.emit(f.disputeManager, "DisputeResolved")
        .withArgs(f.disputeId, ASSESSMENT_ID, f.operator.address, DisputeStatus.Rejected, RESOLUTION_HASH, anyValue);

      const attestation = await f.creditScoreRegistry.getAttestation(ASSESSMENT_ID);
      expect(attestation.disputed).to.equal(false);
      expect(attestation.status).to.equal(1n);
      const dispute = await f.disputeManager.getDispute(f.disputeId);
      expect(dispute.resolvedBy).to.equal(f.operator.address);
      expect(dispute.resolutionHash).to.equal(RESOLUTION_HASH);
    });

    it("upholds a claim by revoking the attestation, blocking new loans until re-attested", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      const resolution = as(f.disputeManager, f.operator).resolveDispute(f.disputeId, true, RESOLUTION_HASH);
      await expect(resolution)
        .to.emit(f.disputeManager, "DisputeResolved")
        .withArgs(f.disputeId, ASSESSMENT_ID, f.operator.address, DisputeStatus.Upheld, RESOLUTION_HASH, anyValue);
      await expect(resolution)
        .to.emit(f.creditScoreRegistry, "ScoreRevoked")
        .withArgs(f.borrower.address, ASSESSMENT_ID, await f.disputeManager.getAddress(), RESOLUTION_HASH, anyValue);

      const [, , , valid] = await f.creditScoreRegistry.currentScore(f.borrower.address);
      expect(valid).to.equal(false);
      await expect(as(f.loanManager, f.borrower).requestLoan(usdc(100), 30)).to.be.revertedWithCustomError(
        f.loanManager,
        "NoValidCreditScore",
      );
    });

    it("still resolves when the attester already revoked the score", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await as(f.creditScoreRegistry, f.operator).revoke(ASSESSMENT_ID, REASON_HASH);
      await expect(as(f.disputeManager, f.operator).resolveDispute(f.disputeId, true, RESOLUTION_HASH)).to.emit(
        f.disputeManager,
        "DisputeResolved",
      );
    });

    it("enforces the reviewer role, conflict-of-interest rule, and notes", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await expect(as(f.disputeManager, f.outsider).resolveDispute(f.disputeId, true, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "AccessControlUnauthorizedAccount")
        .withArgs(f.outsider.address, ROLES.REVIEWER);
      await expect(as(f.disputeManager, f.operator).resolveDispute(f.disputeId, true, ZeroHash)).to.be.revertedWithCustomError(
        f.disputeManager,
        "InvalidResolutionHash",
      );

      await as(f.disputeManager, f.admin).grantRole(ROLES.REVIEWER, f.borrower.address);
      await expect(as(f.disputeManager, f.borrower).resolveDispute(f.disputeId, true, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "ReviewerConflict")
        .withArgs(f.borrower.address);
    });

    it("cannot resolve a dispute twice or resolve unknown disputes", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await as(f.disputeManager, f.operator).resolveDispute(f.disputeId, false, RESOLUTION_HASH);
      await expect(as(f.disputeManager, f.operator).resolveDispute(f.disputeId, true, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "DisputeNotOpen")
        .withArgs(f.disputeId, DisputeStatus.Rejected);
      await expect(as(f.disputeManager, f.operator).resolveDispute(99n, true, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.disputeManager, "DisputeNotFound")
        .withArgs(99n);
    });

    it("blocks new disputes and resolutions while paused", async function () {
      const f = await networkHelpers.loadFixture(openDisputeFixture);
      await as(f.disputeManager, f.admin).pause();
      await expect(as(f.disputeManager, f.operator).resolveDispute(f.disputeId, true, RESOLUTION_HASH)).to.be.revertedWithCustomError(
        f.disputeManager,
        "EnforcedPause",
      );
    });
  });
});
