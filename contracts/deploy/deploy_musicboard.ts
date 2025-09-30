import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const d = await deploy("MusicBoard", { from: deployer, log: true });
  log(`MusicBoard deployed at ${d.address}`);
};

export default func;
func.id = "deploy_musicboard";
func.tags = ["MusicBoard"];


