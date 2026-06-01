require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/d8ed0bd1de8242d998a1405b6932ab33",
      // url: "https://eth-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 30000000000, // 30 Gwei
    },
    ganache: {
      url: "HTTP://127.0.0.1:7545",
      accounts: [
        "0x72474d480dd7eb6a1662dafce59e7d6231699b93e66f56387ba2858b90e087b5",
        "0x0ab588fe72f85b79d290d62e67cffc8a29f166c107a39dad994279bac176cd24",
        "0x7f1366008c1dedc98b655a313f30a801733ebf8ad5f506c31267b713181e3a1c",
        "0x333bf3b32af88375ee1e2487b02ca558c75f449da300d80e92a0e6592e98d359",
        "0xf4d3aa8e1a65108a042dfaf58249cab7089302ffec02ab50c7b9d894d35c958f",
      ],
      gasPrice: 30000000000, // 30 Gwei
    },
  },
  etherscan: {
    apiKey:
      process.env.ETHERSCAN_API_KEY || "5FCIE4WK4IU1DNCAGGBXNZJPK49YMIS5FT",
  },
};
