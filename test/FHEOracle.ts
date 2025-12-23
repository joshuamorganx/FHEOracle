import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { FHEOracle, FHEOracle__factory } from "../types";

const ONE_DAY = 24 * 60 * 60;
const PRICE_SCALE = 10n ** 8n;

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function mineAt(timestamp: number) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine", []);
}

async function deployFixture(deployer: HardhatEthersSigner) {
  const factory = (await ethers.getContractFactory("FHEOracle", deployer)) as FHEOracle__factory;
  const contract = (await factory.deploy(deployer.address)) as FHEOracle;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("FHEOracle", function () {
  let signers: Signers;
  let contract: FHEOracle;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture(signers.deployer));

    const latest = await ethers.provider.getBlock("latest");
    const currentDay = Math.floor((latest?.timestamp ?? 0) / ONE_DAY);
    const fixedDay = currentDay + 5;
    await mineAt(fixedDay * ONE_DAY + 123);
  });

  it("wins and receives encrypted points equal to stake", async function () {
    await fhevm.initializeCLIApi();

    const tokenETH = 0;
    const predicted = 4000n * PRICE_SCALE;
    const stakeWei = 1_000_000_000_000_000_000n;

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(predicted)
      .addBool(true)
      .encrypt();

    const txBet = await contract
      .connect(signers.alice)
      .placeBet(tokenETH, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: stakeWei,
      });
    await txBet.wait();

    const targetDay = (await contract.currentDayIndex()) + 1n;
    expect(await contract.isBetClaimable(signers.alice.address, tokenETH, Number(targetDay))).to.eq(false);

    await mineAt((Number(targetDay) * ONE_DAY) + 10);
    const txPrice = await contract.connect(signers.deployer).updateDailyPrice(tokenETH, predicted + 1n);
    await txPrice.wait();

    await mineAt(((Number(targetDay) + 1) * ONE_DAY) + 10);
    expect(await contract.isBetClaimable(signers.alice.address, tokenETH, Number(targetDay))).to.eq(true);

    const txClaim = await contract.connect(signers.alice).claim(tokenETH, Number(targetDay));
    await txClaim.wait();

    const encryptedPoints = await contract.getEncryptedPoints(signers.alice.address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedPoints,
      contractAddress,
      signers.alice,
    );
    expect(clearPoints).to.eq(stakeWei);
  });

  it("loses and receives no additional points", async function () {
    await fhevm.initializeCLIApi();

    const tokenBTC = 1;
    const predicted = 100_000n * PRICE_SCALE;
    const stakeWei = 500_000_000_000_000_000n;

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(predicted)
      .addBool(false)
      .encrypt();

    await (
      await contract
        .connect(signers.alice)
        .placeBet(tokenBTC, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
          value: stakeWei,
        })
    ).wait();

    const targetDay = (await contract.currentDayIndex()) + 1n;

    await mineAt((Number(targetDay) * ONE_DAY) + 10);
    await (await contract.connect(signers.deployer).updateDailyPrice(tokenBTC, predicted + 1n)).wait();

    await mineAt(((Number(targetDay) + 1) * ONE_DAY) + 10);
    await (await contract.connect(signers.alice).claim(tokenBTC, Number(targetDay))).wait();

    const encryptedPoints = await contract.getEncryptedPoints(signers.alice.address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedPoints,
      contractAddress,
      signers.alice,
    );
    expect(clearPoints).to.eq(0n);
  });

  it("rejects early claim and double claim", async function () {
    await fhevm.initializeCLIApi();

    const tokenETH = 0;
    const predicted = 3000n * PRICE_SCALE;
    const stakeWei = 100_000_000_000_000_000n;

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(predicted)
      .addBool(true)
      .encrypt();

    await (
      await contract
        .connect(signers.alice)
        .placeBet(tokenETH, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
          value: stakeWei,
        })
    ).wait();

    const targetDay = (await contract.currentDayIndex()) + 1n;

    await expect(contract.connect(signers.alice).claim(tokenETH, Number(targetDay))).to.be.revertedWithCustomError(
      contract,
      "PriceNotAvailable",
    );

    await mineAt((Number(targetDay) * ONE_DAY) + 10);
    await (await contract.connect(signers.deployer).updateDailyPrice(tokenETH, predicted + 1n)).wait();

    await expect(contract.connect(signers.alice).claim(tokenETH, Number(targetDay))).to.be.revertedWithCustomError(
      contract,
      "BetNotClaimable",
    );

    await mineAt(((Number(targetDay) + 1) * ONE_DAY) + 10);
    await (await contract.connect(signers.alice).claim(tokenETH, Number(targetDay))).wait();

    await expect(contract.connect(signers.alice).claim(tokenETH, Number(targetDay))).to.be.revertedWithCustomError(
      contract,
      "BetNotClaimable",
    );
  });
});
