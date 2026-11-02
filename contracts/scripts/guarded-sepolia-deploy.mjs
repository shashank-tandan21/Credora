// Sepolia deployment gate: the full local test suite must pass before any testnet
// transaction is sent. Only then is the deploy script run with the confirmation flag.
import { spawnSync } from "node:child_process";

function run(command, env = process.env) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) {
    console.error(`\nAborted: "${command}" exited with status ${result.status}. Nothing was deployed.`);
    process.exit(result.status ?? 1);
  }
}

run("npx hardhat test mocha");
run("npx hardhat run scripts/deploy.ts --network sepolia", { ...process.env, CONFIRM_SEPOLIA_DEPLOY: "yes" });
run("npx hardhat run scripts/export-artifacts.ts");
