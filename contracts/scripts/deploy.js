const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const EXPECTED_CHAIN_ID = 91562037n;
const DAY = 24 * 60 * 60;

function intEnv(name, fallback, { min, max }) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No deployer key. Set DEPLOYER_PRIVATE_KEY in contracts/.env");
  }
  const [deployer] = signers;

  const net = await ethers.provider.getNetwork();
  if (network.name !== "hardhat" && net.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Connected to chain ${net.chainId}, expected ${EXPECTED_CHAIN_ID} (MST Testnet).`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.address} has no funds. Use https://faucet.mstblockchain.com`);
  }

  const admin = process.env.ADMIN_ADDRESS ? ethers.getAddress(process.env.ADMIN_ADDRESS) : deployer.address;
  const verifier = process.env.VERIFIER_ADDRESS ? ethers.getAddress(process.env.VERIFIER_ADDRESS) : null;
  const adminDelay = intEnv("ADMIN_TRANSFER_DELAY", DAY, { min: 0, max: 30 * DAY });
  const creditsPerTree = intEnv("CREDITS_PER_TREE", 22, { min: 1, max: 1000 });
  const validityDays = intEnv("VALIDITY_DAYS", 3650, { min: 1, max: 36500 });

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Admin:    ${admin}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} tMSTC`);

  const factory = await ethers.getContractFactory("CarbonCreditRegistry");
  const registry = await factory.deploy(
    admin,
    adminDelay,
    "https://carbon-ledger.invalid/credits/{id}.json",
    creditsPerTree,
    validityDays * DAY
  );
  const receipt = await registry.deploymentTransaction().wait();
  const address = await registry.getAddress();
  console.log(`CarbonCreditRegistry deployed: ${address}`);
  console.log(`Transaction: ${receipt.hash}`);

  if (verifier) {
    if (admin.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("Skipping verifier grant: the admin is not the deployer. Grant it from the admin account (Admin tab).");
    } else {
      const role = await registry.VERIFIER_ROLE();
      await (await registry.grantRole(role, verifier)).wait();
      console.log(`VERIFIER_ROLE granted to ${verifier}`);
    }
  }

  const deployment = {
    chainId: Number(net.chainId),
    address,
    deployBlock: receipt.blockNumber,
    transactionHash: receipt.hash,
    admin,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployment, null, 2));

  // Point the front end at the new contract.
  const feFile = path.join(__dirname, "..", "..", "frontend", "src", "generated", "deployment.json");
  fs.writeFileSync(feFile, JSON.stringify({ chainId: deployment.chainId, address }, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), feFile)}`);
  console.log(`Explorer: https://testnet.mstscan.com/address/${address}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
