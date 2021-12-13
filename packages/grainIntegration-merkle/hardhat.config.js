/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-truffle5");
require("hardhat-watcher");

module.exports = {
  solidity: "0.6.8",
  watcher: {
    compiling: {
      tasks: ["compile"],
    },
    testing: {
      tasks: [{ command: "test" }],
      files: ["./test/**/*", "./contracts/**/*"],
    },
  },
};
