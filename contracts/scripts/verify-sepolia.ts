import { readFile } from "node:fs/promises";
import path from "node:path";

import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import hre from "hardhat";

import { CONTRACT_NAMES, type DeploymentManifest, DEPLOYMENTS_DIR } from "./lib/protocol.js";

// Verifies every contract recorded in deployments/sepolia.json on Etherscan.
// Requires ETHERSCAN_API_KEY (environment variable or Hardhat keystore).

const manifest = JSON.parse(await readFile(path.join(DEPLOYMENTS_DIR, "sepolia.json"), "utf8")) as DeploymentManifest;

for (const name of CONTRACT_NAMES) {
  const record = manifest.contracts[name];
  console.log(`Verifying ${name} at ${record.address}`);
  await verifyContract(
    {
      address: record.address,
      constructorArgs: record.constructorArgs,
      contract: `contracts/${name}.sol:${name}`,
      provider: "etherscan",
    },
    hre,
  );
}
