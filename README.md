# MetaNode stake contract

操作流程以及命令

## 拉取项目

```zsh
git clone https://github.com/MetaNodeAcademy/Advanced2-contract-stake/tree/main/stake-contract
```

## 安装依赖

```zsh
npm install
```

## 编译

```
npx hardhat compile
```

**注意!!!!** 

`hardhat` 这个库有个巨坑!!! 他自己生成的文件无论你的 solidity 文件叫什么名字, 编译出来统一叫:

`stake-contract/ignition/modules/Rcc.js`

还要自己将其重命名为 `stake-contract/ignition/modules/MetaNode.js` . 差点没被害死╮(╯_╰)╭ AI也查不出来!!!

所以这步完全可以用 Remix 取代!


## 部署 MetaNode token

```zsh
npx hardhat ignition deploy ./ignition/modules/MetaNode.js
```

部署之后在 terminal 拿到合约地址,比如: `0x264e0349deEeb6e8000D40213Daf18f8b3dF02c3`

## 部署完 MetaNode Token,拿以上地址作为 MetaNodeStake 合约的初始化参数,在 MetaNodeStake 中设置

```js
const MetaNodeToken = "0x264e0349deEeb6e8000D40213Daf18f8b3dF02c3";
```

## 将 stake 合约部署到 sepolia 上

```zsh
npx hardhat run scripts/MetaNodeStake.js --network sepolia
```

## 运行资金池函数 `addPool`:

```zsh
npx hardhat run scripts/addPool.js --network sepolia
```


# 覆盖率测试
```
kenny@hc-xy stake-contract % npx hardhat coverage          

Version
=======
> solidity-coverage: v0.8.17

Instrumenting for coverage...
=============================

> MetaNode.sol
> MetaNodeStake.sol
> TestERC20.sol

Compilation:
============

Compiled 33 Solidity files successfully (evm target: paris).

Network Info
============
> HardhatEVM: v2.28.6
> network:    hardhat



  KennyTest
erc20address:: 0x8464135c8F25Da09e49BC8782676a84730C318bC
当前区块高度:: 1
metaNodeStakeContract:: 0x948B3c65b89DF0B4894ABE91E6D02FE579834F8F
    ✔ deploy (169ms)
    ✔ setMetaNode
    ✔ pauseWithdraw
    ✔ unpauseWithdraw
    ✔ pauseClaim
    ✔ unpauseClaim
    ✔ setStartBlock
    ✔ setEndBlock
    ✔ addPool
    ✔ updatePool
    ✔ getMultiplier
    ✔ deposit

  KennyTest - branch and edge coverage
    ✔ covers admin-only controls and parameter guards
    ✔ covers deposit validations for ETH and ERC20 pools
    ✔ covers unstake and withdraw lock lifecycle for ETH and ERC20
    ✔ covers pause guards for claim and withdraw-related functions
    ✔ covers claim payout path and pending reset
    ✔ covers query/update helper branches
    ✔ covers pendingMetaNode_ = 0
    ✔ covers _safeMetaNodeTransfer with insufficient balance
    ✔ covers claim branch when no new reward should accrue
    ✔ covers withdraw branch when nothing is unlocked
    ✔ covers addPool address rule branches
    ✔ covers getMultiplier clipping branches


  24 passing (819ms)

--------------------|----------|----------|----------|----------|----------------|
File                |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
--------------------|----------|----------|----------|----------|----------------|
 contracts/         |    95.95 |    66.67 |    97.06 |    95.85 |                |
  MetaNode.sol      |      100 |      100 |      100 |      100 |                |
  MetaNodeStake.sol |    95.89 |    66.67 |    96.88 |    95.81 |... 772,773,832 |
  TestERC20.sol     |      100 |      100 |      100 |      100 |                |
--------------------|----------|----------|----------|----------|----------------|
All files           |    95.95 |    66.67 |    97.06 |    95.85 |                |
--------------------|----------|----------|----------|----------|----------------|

> Istanbul reports written to ./coverage/ and ./coverage.json
```