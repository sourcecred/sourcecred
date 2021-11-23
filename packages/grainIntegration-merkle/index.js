// @flow

const ethers = require("ethers");
const promptRequire =
  /* eslint-disable camelcase */
  // $FlowIgnore[cannot-resolve-name]
  typeof __non_webpack_require__ !== "undefined"
    ? /* eslint-disable no-undef */
      // $FlowIgnore[cannot-resolve-name]
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
  //const provider = new ethers.providers.JsonRpcProvider();
  //const signer = provider.getSigner();
  const signer = getWalletAndProvider();
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
  const tree = createMerkleTree(payoutDistributions);
  const merkleContract = new ethers.Contract(
    address,
    redeemContract.abi,
    signer
  );
  try {
    const nextId = await getNextDistributionId(merkleContract);
    await checkPermissions(merkleContract, signer);
    const defaultDelay = await merkleContract.minDelay();
    await merkleContract.seedDistribution(
      nextId,
      tree.getHexRoot(),
      Math.ceil(defaultDelay + Date.now() / 1000)
    );
  } catch (e) {
    throw new Error(`merkle integration error: ${e}`);
  }
  return {
    transferredGrain: [],
    configUpdate: configReturn
  };
};

function createMerkleTree(elements) {
  const hashedElements = elements.map(([address, amount]) => {
    const hash = soliditySha3(address, amount);
    return hash;
  });
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
  if (Number.isNaN(possibleInt)) {
    console.error(`Not a number; ${response}; Please try again...`);
    return getDelayTime();
  }
  return possibleInt * 86400;
}

function confirmDeploy() {
  const response = prompt(
    "No distribution contract configured: do you want to deploy one now? [y/N] "
  );
  if (response.toLowerCase() === "y") return;

  throw new Error("User exited");
}

async function checkPermissions(contract, signer) {
  // These _could_ be hardcoded
  const AdminRole = await contract.DEFAULT_ADMIN_ROLE();
  const SeederRole = await contract.SEEDER_ROLE();
  const signerAddress = await signer.getAddress();
  const signerIsAdmin = await contract.hasRole(AdminRole, signerAddress);
  const signerIsSeeder = await contract.hasRole(SeederRole, signerAddress);
  if (signerIsAdmin && !signerIsSeeder) {
    console.warn(
      "Your active account does not have permission to seed on chain grain distributions.Either grant the current account permissions or utilize an account that has the permissions"
    );
    await assignSeederToAccount(contract, signerAddress);
  } else if (!signerIsAdmin && !signerIsSeeder) {
    console.error(
      `Account ${signerAddress} cannot distribute grain. exiting...`
    );
  }
}

async function assignSeederToAccount(
  contract /*: any*/,
  signerAddress /*: string*/
) {
  const SeederRole = await contract.SEEDER_ROLE();
  const seederAddress = prompt(
    `Enter address to grant seeder role (default: ${signerAddress}): `,
    signerAddress
  );
  await contract.grantRole(SeederRole, seederAddress);
}

async function getNextDistributionId(contract /*: any*/) {
  const publishFilter = contract.filters.DistributionPublished();
  const publishEvents = await contract.queryFilter(publishFilter);
  const lastPublishedId = publishEvents.map(e => e.args._id)[
    publishEvents.length - 1
  ];
  return lastPublishedId ? lastPublishedId.add(1) : 0;
}

function getWalletAndProvider() {
  const { ETH_MNEMONIC, ACCOUNT_PATH, ETH_NETWORK } = process.env;
  if (!ETH_MNEMONIC) throw new Error("Can't auth: No mnemonic set");
  const provider = ethers.getDefaultProvider(ETH_NETWORK);
  const wallet = ethers.Wallet.fromMnemonic(ETH_MNEMONIC, ACCOUNT_PATH);
  return wallet.connect(provider);
}

module.exports = { merkleIntegration };
