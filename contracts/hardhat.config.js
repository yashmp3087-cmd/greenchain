require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const MST_CHAIN_ID = 91562037;
const MST_RPC_URL = process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com";

// Accept a key with or without 0x, ignore anything malformed instead of leaking it in an error.
function loadKey() {
  const raw = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? [key] : [];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // "paris" avoids the PUSH0 opcode, which not every EVM-compatible chain supports.
      evmVersion: "paris",
    },
  },
  networks: {
    mstTestnet: {
      url: MST_RPC_URL,
      chainId: MST_CHAIN_ID,
      accounts: loadKey(),
    },
  },
};
