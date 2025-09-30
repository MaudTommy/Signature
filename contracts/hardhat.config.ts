import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: { deployer: 0 },
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 800 },
      evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
    },
  },
  typechain: { target: "ethers-v6", outDir: "types" },
  etherscan: { apiKey: { sepolia: ETHERSCAN_API_KEY } },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
    tests: "./test",
    deployments: "./deployments",
  },
};

export default config;


