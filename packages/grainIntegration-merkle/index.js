// @flow

const ethers = require("ethers");
const redeemContract = require("./artifacts/contracts/MerkleRedeem.sol/MerkleRedeem.json");

/*::
type Currency = {|
  +type: "EVM",
  +chainId: string,
  +tokenAddress: string
|}

type Config = {|
  +accountingEnabled: boolean,
  +processDistributions: boolean,
  +currency: Currency
|}
*/

const merkleIntegration /*: any*/ = async (
  _unused_payoutDistributions,
  config /*: Config */
) => {
  const provider = new ethers.providers.JsonRpcProvider();
  const signer = provider.getSigner();
  const contract = await deployMerkleContract(config.currency, signer);
  return {
    transferredGrain: []
  };
};

async function deployMerkleContract(
  config /*: Currency*/,
  signer
) /*: Promise<string>*/ {
  const factory = new ethers.ContractFactory(
    redeemContract.abi,
    redeemContract.bytecode,
    signer
  );

  const contract = await factory.deploy(config.tokenAddress, config.chainId);

  console.log("Contract Deployed at: ", contract.address);
  return contract;
}

module.exports = { merkleIntegration };
