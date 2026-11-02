import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";

import { DAY, ROLES, usdc } from "../scripts/lib/protocol.js";
import { as, networkHelpers, protocolFixture } from "./helpers.js";

describe("MockUSDC", function () {
  it("uses 6 decimals and test-only metadata", async function () {
    const { mockUsdc } = await networkHelpers.loadFixture(protocolFixture);
    expect(await mockUsdc.decimals()).to.equal(6n);
    expect(await mockUsdc.symbol()).to.equal("mUSDC");
    expect(await mockUsdc.name()).to.equal("Mock USD Coin");
  });

  it("restricts minting to MINTER_ROLE", async function () {
    const { mockUsdc, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(mockUsdc, outsider).mint(outsider.address, usdc(1)))
      .to.be.revertedWithCustomError(mockUsdc, "AccessControlUnauthorizedAccount")
      .withArgs(outsider.address, ROLES.MINTER);
  });

  it("bounds each mint and rejects the zero address", async function () {
    const { mockUsdc, admin, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(mockUsdc, admin).mint(outsider.address, 0n))
      .to.be.revertedWithCustomError(mockUsdc, "MintAmountInvalid")
      .withArgs(0n);
    const tooMuch = usdc(1_000_001);
    await expect(as(mockUsdc, admin).mint(outsider.address, tooMuch))
      .to.be.revertedWithCustomError(mockUsdc, "MintAmountInvalid")
      .withArgs(tooMuch);
    await expect(as(mockUsdc, admin).mint("0x0000000000000000000000000000000000000000", usdc(1))).to.be.revertedWithCustomError(
      mockUsdc,
      "ZeroAddress",
    );
  });

  it("rate-limits the public faucet", async function () {
    const { mockUsdc, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(mockUsdc, outsider).faucet())
      .to.emit(mockUsdc, "FaucetClaimed")
      .withArgs(outsider.address, usdc(1_000), anyValue);
    expect(await mockUsdc.balanceOf(outsider.address)).to.equal(usdc(1_000));

    const claimedAt = await mockUsdc.lastFaucetClaim(outsider.address);
    await expect(as(mockUsdc, outsider).faucet())
      .to.be.revertedWithCustomError(mockUsdc, "FaucetCooldownActive")
      .withArgs(claimedAt + DAY);

    await networkHelpers.time.increase(DAY);
    await as(mockUsdc, outsider).faucet();
    expect(await mockUsdc.balanceOf(outsider.address)).to.equal(usdc(2_000));
  });

  it("lets only the admin disable the faucet", async function () {
    const { mockUsdc, admin, outsider } = await networkHelpers.loadFixture(protocolFixture);
    await expect(as(mockUsdc, outsider).setFaucetEnabled(false)).to.be.revertedWithCustomError(
      mockUsdc,
      "AccessControlUnauthorizedAccount",
    );
    await expect(as(mockUsdc, admin).setFaucetEnabled(false))
      .to.emit(mockUsdc, "FaucetStatusChanged")
      .withArgs(false, anyValue);
    await expect(as(mockUsdc, outsider).faucet()).to.be.revertedWithCustomError(mockUsdc, "FaucetDisabled");
  });
});
