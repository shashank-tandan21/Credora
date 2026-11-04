import { formatEther, isAddress } from "ethers";
import { network } from "hardhat";

import {
  buildManifest,
  deployProtocol,
  LOCAL_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  seedLocalLiquidity,
  writeManifest,
} from "./lib/protocol.js";

// Deploys the full protocol to the network selected with --network.
//   localhost: deploys, seeds test balances and 25,000 mUSDC pool liquidity, writes
//              deployments/localhost.{json,env}. Addresses are deterministic on a fresh node.
//   sepolia:   refuses to run unless invoked through `npm run deploy:sepolia`, which runs
//              the full test suite first and sets CONFIRM_SEPOLIA_DEPLOY=yes.
// Any other chain (including mainnet) is rejected.

const { ethers, networkName } = await network.create();
const chainId = (await ethers.provider.getNetwork()).chainId;
const [deployer] = await ethers.getSigners();
if (deployer === undefined) {
  throw new Error(`No deployer account is configured for network "${networkName}".`);
}

if (chainId !== LOCAL_CHAIN_ID && chainId !== SEPOLIA_CHAIN_ID) {
  throw new Error(`Refusing to deploy to unsupported chain ${chainId}. Only Hardhat (31337) and Sepolia are allowed.`);
}
if (chainId === SEPOLIA_CHAIN_ID && process.env.CONFIRM_SEPOLIA_DEPLOY !== "yes") {
  throw new Error("Sepolia deployment must run through `npm run deploy:sepolia`, which runs the local test suite first.");
}

const operator = process.env.OPERATOR_ADDRESS?.trim() || deployer.address;
if (!isAddress(operator)) {
  throw new Error(`OPERATOR_ADDRESS is not a valid address: ${operator}`);
}

const balance = await ethers.provider.getBalance(deployer.address);
console.log(`Network:  ${networkName} (chain ${chainId})`);
console.log(`Deployer: ${deployer.address} (${formatEther(balance)} ETH)`);
console.log(`Operator: ${operator}`);

const protocol = await deployProtocol(ethers, {
  admin: deployer,
  operator,
  faucetEnabled: true,
  log: console.log,
});

const oracle = await ethers.deployContract("MockEthUsdFeed", [2000_00000000], deployer);
await oracle.waitForDeployment();
const oracleTransaction = oracle.deploymentTransaction();
if (oracleTransaction === null) throw new Error("MockEthUsdFeed has no deployment transaction");
const oracleReceipt = await oracleTransaction.wait();
if (oracleReceipt === null || oracleReceipt.status !== 1) throw new Error("MockEthUsdFeed deployment failed");
const oracleAddress = await oracle.getAddress();
console.log(`  MockEthUsdFeed       ${oracleAddress}  (ETH/USD $2,000 local feed)`);

let seeded = false;
if (chainId === LOCAL_CHAIN_ID) {
  console.log("Seeding local balances");
  const signers = await ethers.getSigners();
  await seedLocalLiquidity(protocol, {
    admin: deployer,
    recipients: signers.slice(0, 5).map((signer) => signer.address),
    log: console.log,
  });
  seeded = true;
}

if (networkName === "default") {
  console.log("In-process network is ephemeral; no deployment manifest written. Use --network localhost.");
} else {
  const manifest = buildManifest(networkName, chainId, deployer.address, protocol, seeded);
  manifest.oracle = {
    ethUsdFeed: {
      address: oracleAddress,
      transactionHash: oracleTransaction.hash,
      blockNumber: oracleReceipt.blockNumber,
      constructorArgs: [2000_00000000],
    },
  };
  const file = await writeManifest(manifest);
  console.log(`Manifest written to ${file}`);
  console.log(`Environment values written to ${file.replace(/\.json$/, ".env.example")}`);
}
