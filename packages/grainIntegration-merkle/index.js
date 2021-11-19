// @flow

const ethers = require("ethers");
const promptRequire =
  /* eslint-disable camelcase */
  typeof __non_webpack_require__ !== "undefined"
    ? /* eslint-disable no-undef */
      __non_webpack_require__
    : require;
const prompt = promptRequire("prompt-sync")({ sigint: true });
const { MerkleTree } = require("merkletreejs");
const { soliditySha3 } = require("web3-utils");
const keccak256 = require("keccak256");

const redeemContract = require("./artifacts/contracts/MerkleRedeem.sol/MerkleRedeem.json");

/*::
type Integration = {|
    contractAddress: string
|}
type Currency = {|
  +type: "EVM",
  +chainId: string,
  +tokenAddress: string,
|}

type Config = {|
  +accountingEnabled: boolean,
  +processDistributions: boolean,
  +currency: Currency,
  +integration: Integration
|}
*/

const merkleIntegration /*: any*/ = async (
  payoutDistributions,
  config /*: Config */
) => {
  const { currency, integration: integrationConfig } = config;
  const provider = new ethers.providers.JsonRpcProvider();
  const signer = provider.getSigner();
  console.log({ config, integrationConfig });
  let address = integrationConfig
    ? integrationConfig.contractAddress
    : undefined;
  let configReturn = {};
  if (!address) {
    address = await deployMerkleContract(currency, signer);
    configReturn = {
      contractAddress: address
    };
  }
  console.log(payoutDistributions, address);
  const tree = createMerkleTree(payoutDistributions);
  const merkleContract = new ethers.Contract(
    address,
    redeemContract.abi,
    signer
  );
  try {
    const defaultDelay = await merkleContract.minDelay();
    await merkleContract.seedDistribution(
      0,
      tree.getHexRoot(),
      Math.ceil(defaultDelay + Date.now() / 1000)
    );
  } catch (e) {
    throw new Error(`merkle integration error: ${e}`);
  }
  return {
    transferredGrain: [],
    configUpdate: {} //configReturn
  };
};

function createMerkleTree(elements) {
  const hashedElements = elements.map(([address, amount]) => {
    console.log({ address, amount });
    const hash = soliditySha3(address, amount);
    return hash;
  });
  console.log({ hashedElements });
  return new MerkleTree(hashedElements, keccak256, {
    hashLeaves: false,
    sortPairs: true
  });
}

async function deployMerkleContract(
  config /*: Currency*/,
  signer
) /*: Promise<string>*/ {
  const factory = new ethers.ContractFactory(
    redeemContract.abi,
    redeemContract.bytecode,
    signer
  );
  confirmDeploy();
  const delay = getDelayTime();
  const contract = await factory.deploy(config.tokenAddress, delay);

  console.log("Contract Deployed at: ", contract.address);
  return contract.address;
}

function getDelayTime() {
  const response = prompt(
    "how long should the pause period be before funds can be claimed, in days? This can be modified later. (default: 0 days): ",
    "0"
  );
  const possibleInt = Number.parseInt(response);
  if (Number.isNaN(possibleInt)) return getDelayTime();
  return possibleInt * 86400;
}

function confirmDeploy() {
  const response = prompt(
    "No distribution contract configured: do you want to deploy one now? [y/N] "
  );
  if (response.toLowerCase() === "y") return;

  throw new Error("User exited");
}

module.exports = { merkleIntegration };
