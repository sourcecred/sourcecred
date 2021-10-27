/* global artifacts, contract, web3, assert */
const TToken = artifacts.require("./TToken.sol");
const Redeem = artifacts.require("./MerkleRedeem.sol");
const { utils, eth } = web3;
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { soliditySha3 } = require("web3-utils");
const { increaseTime } = require("./helpers");

function createMerkleTree(elements) {
  return new MerkleTree(elements, keccak256, {
    hashLeaves: false,
    sortPairs: true,
  });
}

contract("MerkleRedeem - High Volume", accounts => {
  const admin = accounts[0];

  let redeem;
  let REDEEM;

  let tbal;
  let TBAL;

  const TEST_QUANTITY = 200;

  beforeEach(async () => {
    tbal = await TToken.new("Test Bal", "TBAL", 18);
    TBAL = tbal.address;

    redeem = await Redeem.new(TBAL, 0);

    const SEEDER_ROLE = await redeem.SEEDER_ROLE();
    await redeem.grantRole(SEEDER_ROLE, admin);
    REDEEM = redeem.address;

    await tbal.mint(REDEEM, utils.toWei("1450000"));
  });

  it("stores " + TEST_QUANTITY + " allocations", async () => {
    const lastBlock = await web3.eth.getBlock("latest");
    const now = lastBlock.timestamp;
    const addresses = [...Array(TEST_QUANTITY).keys()].map(
      () => eth.accounts.create().address
    );

    const elements = addresses.map((address, num) =>
      soliditySha3(address, utils.toWei((num * 10).toString()))
    );
    const merkleTree = createMerkleTree(elements);
    const root = merkleTree.getHexRoot();

    await redeem.seedDistribution(1, root, now + 1);

    const proof36 = merkleTree.getHexProof(elements[36]);
    let result = await redeem.verifyClaim(
      addresses[36],
      1,
      utils.toWei("360"),
      proof36
    );
    assert(result, "account 36 should have an allocation");

    const proof48 = merkleTree.getHexProof(elements[48]);
    result = await redeem.verifyClaim(
      addresses[48],
      1,
      utils.toWei("480"),
      proof48
    );
    assert(result, "account 48 should have an allocation");
  });

  describe("When a user has several allocation to claim", () => {
    const claimBalance1 = utils.toWei("1111");
    const elements1 = [utils.soliditySha3(accounts[1], claimBalance1)];
    const merkleTree1 = createMerkleTree(elements1);
    const root1 = merkleTree1.getHexRoot();

    const claimBalance2 = utils.toWei("1222");
    const elements2 = [utils.soliditySha3(accounts[1], claimBalance2)];
    const merkleTree2 = createMerkleTree(elements2);
    const root2 = merkleTree2.getHexRoot();

    const claimBalance3 = utils.toWei("1333");
    const elements3 = [utils.soliditySha3(accounts[1], claimBalance3)];
    const merkleTree3 = createMerkleTree(elements3);
    const root3 = merkleTree3.getHexRoot();

    const claimBalance4 = utils.toWei("1444");
    const elements4 = [utils.soliditySha3(accounts[1], claimBalance4)];
    const merkleTree4 = createMerkleTree(elements4);
    const root4 = merkleTree4.getHexRoot();

    const claimBalance5 = utils.toWei("1555");
    const elements5 = [utils.soliditySha3(accounts[1], claimBalance5)];
    const merkleTree5 = createMerkleTree(elements5);
    const root5 = merkleTree5.getHexRoot();

    const roots = [root1, root2, root3, root4, root5];

    beforeEach(async () => {
      for (let i = 0; i < roots.length; i++) {
        const lastBlock = await web3.eth.getBlock("latest");
        const now = lastBlock.timestamp;

        await redeem.seedDistribution(i + 1, roots[i], now + 1);

        await increaseTime(7);
      }
    });

    it("Allows the user to claim multiple weeks at once", async () => {
      await increaseTime(1);

      const proof1 = merkleTree1.getHexProof(elements1[0]);
      const proof2 = merkleTree2.getHexProof(elements2[0]);
      const proof3 = merkleTree3.getHexProof(elements3[0]);
      const proof4 = merkleTree4.getHexProof(elements4[0]);
      const proof5 = merkleTree5.getHexProof(elements5[0]);

      await redeem.claimWeeks(
        accounts[1],
        [
          [1, claimBalance1, proof1],
          [2, claimBalance2, proof2],
          [3, claimBalance3, proof3],
          [4, claimBalance4, proof4],
          [5, claimBalance5, proof5],
        ],
        { from: accounts[1] }
      );

      const result = await tbal.balanceOf(accounts[1]);
      assert(
        result.toString() === utils.toWei("6665"),
        "user should receive all tokens, including current week"
      );
    });
  });
});
