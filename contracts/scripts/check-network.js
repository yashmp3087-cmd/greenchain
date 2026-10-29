const { ethers, network } = require("hardhat");

const EXPECTED_CHAIN_ID = 91562037n;

async function main() {
  const net = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlockNumber();
  console.log(`Network:  ${network.name}`);
  console.log(`Chain ID: ${net.chainId} (expected ${EXPECTED_CHAIN_ID})`);
  console.log(`Block:    ${block}`);
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error("RPC reports a different chain ID. Check MST_RPC_URL.");
  }
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.log("No deployer key configured (DEPLOYER_PRIVATE_KEY).");
    return;
  }
  const bal = await ethers.provider.getBalance(signers[0].address);
  console.log(`Deployer: ${signers[0].address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} tMSTC`);
  if (bal === 0n) console.log("Balance is zero — request funds at https://faucet.mstblockchain.com");
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
