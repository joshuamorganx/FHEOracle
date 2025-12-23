import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

function parseToken(token: string): number {
  const t = token.toUpperCase();
  if (t === "ETH" || t === "0") return 0;
  if (t === "BTC" || t === "1") return 1;
  throw new Error(`Invalid --token. Use ETH|BTC|0|1`);
}

task("task:oracle:address", "Prints the FHEOracle address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const fheOracle = await deployments.get("FHEOracle");
  console.log("FHEOracle address is " + fheOracle.address);
});

task("task:oracle:update-price", "Updates today's price for a token (oracle only)")
  .addParam("token", "ETH|BTC|0|1")
  .addParam("price", "uint64 price with 1e8 decimals, e.g. 4000_00000000")
  .addOptionalParam("address", "Optionally specify the FHEOracle contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const token = parseToken(taskArguments.token);
    const price = BigInt(taskArguments.price);

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHEOracle");
    console.log(`FHEOracle: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHEOracle", deployment.address, signer);

    const day = await contract.currentDayIndex();
    console.log(`currentDayIndex=${day}`);

    const tx = await contract.updateDailyPrice(token, price);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:oracle:place-bet", "Places a bet for the next day")
  .addParam("token", "ETH|BTC|0|1")
  .addParam("price", "uint64 predicted price with 1e8 decimals")
  .addParam("direction", "true for 'actual > predicted', false for 'actual < predicted'")
  .addParam("stakeWei", "ETH stake in wei (uint64 max)")
  .addOptionalParam("address", "Optionally specify the FHEOracle contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const token = parseToken(taskArguments.token);
    const predictedPrice = BigInt(taskArguments.price);
    const direction = taskArguments.direction === "true";
    const stakeWei = BigInt(taskArguments.stakeWei);

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHEOracle");
    console.log(`FHEOracle: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHEOracle", deployment.address, signer);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add64(predictedPrice)
      .addBool(direction)
      .encrypt();

    const tx = await contract.placeBet(token, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
      value: stakeWei,
    });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:oracle:claim", "Claims points for a settled day (available the next day)")
  .addParam("token", "ETH|BTC|0|1")
  .addParam("day", "uint32 day index")
  .addOptionalParam("address", "Optionally specify the FHEOracle contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const token = parseToken(taskArguments.token);
    const day = parseInt(taskArguments.day);
    if (!Number.isInteger(day) || day < 0) throw new Error(`Invalid --day`);

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHEOracle");
    console.log(`FHEOracle: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHEOracle", deployment.address, signer);

    const tx = await contract.claim(token, day);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:oracle:decrypt-points", "Decrypts encrypted points for the given user")
  .addOptionalParam("user", "User address (defaults to signer[0])")
  .addOptionalParam("address", "Optionally specify the FHEOracle contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHEOracle");
    console.log(`FHEOracle: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const userAddress = (taskArguments.user as string | undefined) ?? signers[0].address;

    const contract = await ethers.getContractAt("FHEOracle", deployment.address);
    const encryptedPoints = await contract.getEncryptedPoints(userAddress);

    if (encryptedPoints === ethers.ZeroHash) {
      console.log(`encrypted points: ${encryptedPoints}`);
      console.log("clear points    : 0");
      return;
    }

    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedPoints,
      deployment.address,
      signers[0],
    );

    console.log(`Encrypted points: ${encryptedPoints}`);
    console.log(`Clear points    : ${clearPoints}`);
  });

