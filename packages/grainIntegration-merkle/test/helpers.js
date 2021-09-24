const { promisify } = require("util");

const increaseTime = async days => {
  await promisify(web3.currentProvider.send)({
    jsonrpc: "2.0",
    method: "evm_increaseTime",
    params: [days * 24 * 3600 + 1], // 1 extra second
    id: 0
  });

  await promisify(web3.currentProvider.send)({
    jsonrpc: "2.0",
    method: "evm_mine",
    params: [],
    id: new Date().getSeconds()
  });
};

module.exports = { increaseTime };
