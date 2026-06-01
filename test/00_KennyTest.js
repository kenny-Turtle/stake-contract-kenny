const { ethers, deployments, upgrades, parseEther } = require("hardhat");
const { expect } = require("chai");

describe("KennyTest", async function () {
  let admin, user1, user2, user3;
  let erc20Contract, stakeProxyContract;

  const metaNodePerBlock = 100n;
  const blockHight = 10000;
  const provider = ethers.provider;
  // 解除质押的锁定区块数
  const unstakeLockedBlocks = 10;
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  it("deploy", async function () {
    // 部署 ERC20 合约
    [a0, admin, user1, user2, user3] = await ethers.getSigners();
    const erc20 = await ethers.getContractFactory("MetaNodeToken");
    erc20Contract = await erc20.connect(admin).deploy();
    const erc20address = await erc20Contract.getAddress();
    console.log("erc20address::", erc20address);
    expect(erc20address).to.length.gt(0);

    // 当前区块高度
    const blockNumber = await provider.getBlockNumber();
    console.log("当前区块高度::", blockNumber);
    // 部署 MetaNodeStake
    const metaNodeStake = await ethers.getContractFactory("MetaNodeStake");
    stakeProxyContract = await upgrades.deployProxy(
      metaNodeStake.connect(admin),
      [erc20address, blockNumber, blockNumber + blockHight, metaNodePerBlock],
      { kind: "uups" },
    );
    await stakeProxyContract.waitForDeployment();
    const metaNodeStakeAddress = await stakeProxyContract.getAddress();
    console.log("metaNodeStakeContract::", metaNodeStakeAddress);
    expect(metaNodeStakeAddress).to.length.gt(0);
    // 部署后新增 eth 质押池
    await stakeProxyContract
      .connect(admin)
      .addPool(zeroAddress, 5, 1e15, unstakeLockedBlocks, false);
    const poolLength = await stakeProxyContract.poolLength();
    expect(poolLength).to.length.gt(0);
  });

  it("setMetaNode", async () => {
    const erc20 = await ethers.getContractFactory("MetaNodeToken");
    erc20Contract = await erc20.connect(admin).deploy();
    await erc20Contract.waitForDeployment();
    const erc20ddress = await erc20Contract.getAddress();

    await stakeProxyContract.connect(admin).setMetaNode(erc20ddress);
    const newERC20 = await stakeProxyContract.MetaNode();
    expect(newERC20).to.eq(erc20ddress);
  });

  it("pauseWithdraw", async () => {
    await stakeProxyContract.connect(admin).pauseWithdraw();
    const res = await stakeProxyContract.withdrawPaused();
    expect(res).to.true;
  });

  it("unpauseWithdraw", async () => {
    await stakeProxyContract.connect(admin).unpauseWithdraw();
    const res = await stakeProxyContract.withdrawPaused();
    expect(res).to.false;
  });

  it("pauseClaim", async () => {
    await stakeProxyContract.connect(admin).pauseClaim();
    const res = await stakeProxyContract.claimPaused();
    expect(res).to.true;
  });

  it("unpauseClaim", async () => {
    await stakeProxyContract.connect(admin).unpauseClaim();
    const res = await stakeProxyContract.claimPaused();
    expect(res).to.false;
  });

  it("setStartBlock", async () => {
    // 当前区块高度
    const blockNumber = await provider.getBlockNumber();
    const startBlock = blockNumber;
    await stakeProxyContract.connect(admin).setStartBlock(startBlock);
    const res = await stakeProxyContract.startBlock();
    expect(res).to.eq(startBlock);
  });

  it("setEndBlock", async () => {
    const startBlock = await stakeProxyContract.startBlock();
    const endBlock = startBlock + 100n;
    await stakeProxyContract.connect(admin).setEndBlock(endBlock);
    const res = await stakeProxyContract.endBlock();
    expect(res).to.eq(endBlock);
  });

  it("addPool", async () => {
    const tokenAddress = await erc20Contract.getAddress();
    // 质押池的权重，影响奖励分配
    const poolWeight = 10;
    // 最小质押金额
    const minDepositAmount = BigInt(1e18);
    const withUpdate = false;
    await stakeProxyContract
      .connect(admin)
      .addPool(
        tokenAddress,
        poolWeight,
        minDepositAmount,
        unstakeLockedBlocks,
        withUpdate,
      );
    const poolLength = await stakeProxyContract.poolLength();
    expect(poolLength).to.length.gt(1);
  });

  it("updatePool", async () => {
    await stakeProxyContract.connect(admin).updatePool(0, 1e15, 10);
    await stakeProxyContract.connect(admin).setPoolWeight(0, 20, true);
  });

  it("getMultiplier", async () => {
    // 当前区块高度
    const fromBlock = await stakeProxyContract.startBlock();
    const toBlock = fromBlock + 10n;
    const mul = await stakeProxyContract.getMultiplier(fromBlock, toBlock);
    expect(mul).to.eq(metaNodePerBlock * (toBlock - fromBlock));
  });

  it("deposit", async () => {
    // user1 deposit 10ETH, user2 deposit 20ETH
    await stakeProxyContract
      .connect(user1)
      .depositETH({ value: ethers.parseEther("10") });
    await stakeProxyContract
      .connect(user2)
      .depositETH({ value: ethers.parseEther("20") });

    // user3 deposit 200USD
    await erc20Contract
      .connect(admin)
      .transfer(user3.address, ethers.parseEther("1000"));
    const proxyAddress = await stakeProxyContract.getAddress();
    await erc20Contract
      .connect(user3)
      .approve(proxyAddress, ethers.parseEther("200"));
    await stakeProxyContract
      .connect(user3)
      .deposit(1, ethers.parseEther("200"));

    const user1Stake = await stakeProxyContract.stakingBalance(
      0,
      user1.address,
    );
    const user2Stake = await stakeProxyContract.stakingBalance(
      0,
      user2.address,
    );
    const user3Stake = await stakeProxyContract.stakingBalance(
      1,
      user3.address,
    );
    expect(user1Stake).to.eq(BigInt(10e18));
    expect(user2Stake).to.eq(BigInt(20e18));
    expect(user3Stake).to.eq(BigInt(200e18));
  });
});
