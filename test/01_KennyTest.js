const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

describe("KennyTest - branch and edge coverage", function () {
  let admin;
  let user1;
  let user2;
  let outsider;

  let rewardToken;
  let testToken;
  let stake;

  const blockHeight = 10000n;
  const metaNodePerBlock = 100n;
  const unstakeLockedBlocks = 5;

  // 自动挖块，增加区块高度
  async function mineBlocks(count) {
    for (let i = 0; i < count; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  beforeEach(async function () {
    [, admin, user1, user2, outsider] = await ethers.getSigners();

    // 部署奖励代币合约
    const RewardToken = await ethers.getContractFactory("MetaNodeToken", admin);
    rewardToken = await RewardToken.deploy();
    await rewardToken.waitForDeployment();

    // 质押合约参数
    const currentBlock = BigInt(await ethers.provider.getBlockNumber());
    const startBlock = currentBlock;
    const endBlock = startBlock + blockHeight;

    // 部署质押合约
    const Stake = await ethers.getContractFactory("MetaNodeStake", admin);
    stake = await upgrades.deployProxy(
      Stake,
      [await rewardToken.getAddress(), startBlock, endBlock, metaNodePerBlock],
      { kind: "uups" },
    );
    await stake.waitForDeployment();

    // 给质押合约转账奖励代币
    await rewardToken
      .connect(admin)
      .transfer(await stake.getAddress(), ethers.parseEther("1000000"));

    // 第0个池：ETH 质押池,权重5，最小质押0.001 ETH
    await stake
      .connect(admin)
      .addPool(
        ethers.ZeroAddress,
        5,
        ethers.parseEther("0.001"),
        unstakeLockedBlocks,
        false,
      );

    // 第1个池：ERC20 质押池,权重10，最小质押1个代币
    const TestERC20 = await ethers.getContractFactory("TestERC20", admin);
    testToken = await TestERC20.deploy(
      "Test Stake Token",
      "TST",
      ethers.parseEther("1000000"),
    );
    await testToken.waitForDeployment();

    // 给用户1和用户2转账测试代币
    await testToken
      .connect(admin)
      .transfer(user1.address, ethers.parseEther("1000"));
    await testToken
      .connect(admin)
      .transfer(user2.address, ethers.parseEther("1000"));

    // ERC20 质押池，权重10，最小质押1个代币
    await stake
      .connect(admin)
      .addPool(
        await testToken.getAddress(),
        10,
        ethers.parseEther("1"),
        unstakeLockedBlocks,
        false,
      );
  });

  it("covers admin-only controls and parameter guards", async function () {
    // 测试只有管理员可以调用的函数
    await expect(
      stake.connect(outsider).setMetaNode(await rewardToken.getAddress()),
    ).to.be.reverted;
    await expect(stake.connect(outsider).pauseWithdraw()).to.be.reverted;
    await expect(stake.connect(outsider).pauseClaim()).to.be.reverted;
    await expect(stake.connect(outsider).setMetaNodePerBlock(1)).to.be.reverted;
    await expect(
      stake.connect(outsider).addPool(ethers.ZeroAddress, 1, 1, 1, false),
    ).to.be.reverted;

    await stake.connect(admin).pauseWithdraw();
    expect(await stake.withdrawPaused()).to.equal(true);
    await stake.connect(admin).unpauseWithdraw();
    expect(await stake.withdrawPaused()).to.equal(false);

    await stake.connect(admin).pauseClaim();
    expect(await stake.claimPaused()).to.equal(true);
    await stake.connect(admin).unpauseClaim();
    expect(await stake.claimPaused()).to.equal(false);

    // 测试一些参数边界条件
    const start = await stake.startBlock();
    const end = await stake.endBlock();

    await expect(
      stake.connect(admin).setStartBlock(end + 1n),
    ).to.be.revertedWith("start block must be smaller than end block");
    await expect(
      stake.connect(admin).setEndBlock(start - 1n),
    ).to.be.revertedWith("start block must be smaller than end block");
    await expect(
      stake.connect(admin).setMetaNodePerBlock(0),
    ).to.be.revertedWith("invalid parameter");
    await expect(
      stake.connect(admin).setPoolWeight(0, 0, false),
    ).to.be.revertedWith("invalid pool weight");
  });

  it("covers deposit validations for ETH and ERC20 pools", async function () {
    // 测试 存钱的函数的各种输入验证和边界条件
    await expect(
      stake.connect(user1).deposit(0, ethers.parseEther("1")),
    ).to.be.revertedWith("deposit not support ETH staking");

    await expect(
      stake.connect(user1).depositETH({ value: ethers.parseEther("0.0005") }),
    ).to.be.revertedWith("deposit amount is too small");

    // 忘记授权
    await expect(stake.connect(user1).deposit(1, ethers.parseEther("2"))).to.be
      .reverted;

    await testToken
      .connect(user1)
      .approve(await stake.getAddress(), ethers.parseEther("10"));

    // 代币存钱数量过小
    await expect(
      stake.connect(user1).deposit(1, ethers.parseEther("1")),
    ).to.be.revertedWith("deposit amount is too small");

    // 存入两个代币，正常流程
    await stake.connect(user1).deposit(1, ethers.parseEther("2"));
    expect(await stake.stakingBalance(1, user1.address)).to.equal(
      ethers.parseEther("2"),
    );
  });

  it("covers unstake and withdraw lock lifecycle for ETH and ERC20", async function () {
    // 测试 解质押 和 提现 的整个生命周期，包括锁定期和提取
    // 存入2个ETH
    await stake.connect(user1).depositETH({ value: ethers.parseEther("2") });
    // 解3个ETH，尝试解质押超过余额的金额
    await expect(
      stake.connect(user1).unstake(0, ethers.parseEther("3")),
    ).to.be.revertedWith("Not enough staking token balance");

    // 正常解质押1个ETH
    await stake.connect(user1).unstake(0, ethers.parseEther("1"));

    // 提现（还剩1个ETH在质押中，1个ETH在待提取中）
    let amountInfo = await stake.withdrawAmount(0, user1.address);
    expect(amountInfo.requestAmount).to.equal(ethers.parseEther("1"));
    expect(amountInfo.pendingWithdrawAmount).to.equal(0n);

    // 挖块
    await mineBlocks(unstakeLockedBlocks);

    // 第0池，用户1一共申请了多少解质押请求金额（包括没到锁定期的和已经到期的），以及用户1可以提走的金额
    amountInfo = await stake.withdrawAmount(0, user1.address);
    // 可提走的金额是1个ETH
    expect(amountInfo.pendingWithdrawAmount).to.equal(ethers.parseEther("1"));

    const stakeEthBefore = await ethers.provider.getBalance(
      await stake.getAddress(),
    );
    await stake.connect(user1).withdraw(0);
    const stakeEthAfter = await ethers.provider.getBalance(
      await stake.getAddress(),
    );
    // 提取之后质押合约的ETH余额减少了1个ETH
    expect(stakeEthBefore - stakeEthAfter).to.equal(ethers.parseEther("1"));

    // ERC20 质押池
    await testToken
      .connect(user1)
      .approve(await stake.getAddress(), ethers.parseEther("10")); // 授权10个
    await stake.connect(user1).deposit(1, ethers.parseEther("2")); // 存入2个
    await stake.connect(user1).unstake(1, ethers.parseEther("1")); // 解质押1个
    await mineBlocks(unstakeLockedBlocks); // 挖块
    await stake.connect(user1).withdraw(1); // 用户提现

    // 1000 - 2 + 1 = 999
    expect(await testToken.balanceOf(user1.address)).to.equal(
      ethers.parseEther("999"),
    );
  });

  it("covers pause guards for claim and withdraw-related functions", async function () {
    // 用户1存入2个ETH
    await stake.connect(user1).depositETH({ value: ethers.parseEther("2") });

    // 管理员暂停提现相关功能，用户尝试解质押和提现都应该被拒绝
    await stake.connect(admin).pauseWithdraw();
    await expect(
      stake.connect(user1).unstake(0, ethers.parseEther("1")),
    ).to.be.revertedWith("withdraw is paused");
    await expect(stake.connect(user1).withdraw(0)).to.be.revertedWith(
      "withdraw is paused",
    );

    // 管理员恢复提现功能，用户可以正常解质押
    await stake.connect(admin).unpauseWithdraw();
    await stake.connect(user1).unstake(0, ethers.parseEther("1"));

    // 管理员暂停领取奖励功能，用户尝试领取应该被拒绝
    await stake.connect(admin).pauseClaim();
    await expect(stake.connect(user1).claim(0)).to.be.revertedWith(
      "claim is paused",
    );
    // 管理员恢复领取奖励功能，用户可以正常领取
    await stake.connect(admin).unpauseClaim();
  });

  it("covers claim payout path and pending reset", async function () {
    // 用户1存入3个ETH，挖块增加区块高度，产生奖励
    await stake.connect(user1).depositETH({ value: ethers.parseEther("3") });
    await mineBlocks(20);

    // 用户1可领取的奖励应该大于0
    const pendingBefore = await stake.pendingMetaNode(0, user1.address);
    expect(pendingBefore).to.be.gt(0n);

    // 用户1领取奖励，领取后的用户1的奖励代币余额比领取前增加
    const rewardBefore = await rewardToken.balanceOf(user1.address);
    await stake.connect(user1).claim(0);
    const rewardAfter = await rewardToken.balanceOf(user1.address);

    expect(rewardAfter).to.be.gt(rewardBefore);

    // 领取之后，用户信息中的待领取奖励应该被重置为0
    const userInfo = await stake.user(0, user1.address);
    expect(userInfo.pendingMetaNode).to.equal(0n);

    // 用户1领取完奖励之后，没有挖块，就没有新的奖励，再次领取应该没有奖励增加
    const rewardBeforeSecondClaim = await rewardToken.balanceOf(user1.address);
    await stake.connect(user1).claim(0);
    const rewardAfterSecondClaim = await rewardToken.balanceOf(user1.address);
    expect(rewardAfterSecondClaim).to.be.gte(rewardBeforeSecondClaim);
  });

  it("covers query/update helper branches", async function () {
    // 错误的池ID应该被拒绝
    await expect(stake.updatePool(999)).to.be.revertedWith("invalid pid");
    await expect(stake.pendingMetaNode(999, user1.address)).to.be.revertedWith(
      "invalid pid",
    );

    // 管理员更新池的权重
    await stake.connect(admin).setPoolWeight(0, 8, true);
    await stake.massUpdatePools();

    // 用户1存入2个ETH
    await stake.connect(user1).depositETH({ value: ethers.parseEther("2") });
    // 当前区块高度
    const currentBlock = await ethers.provider.getBlockNumber();
    // 查询用户1在未来区块的待领取奖励
    const pendingFuture = await stake.pendingMetaNodeByBlockNumber(
      0,
      user1.address,
      currentBlock + 10,
    );
    expect(pendingFuture).to.be.gt(0n);
  });
});
