/* global artifacts, contract, web3, assert */
const TToken = artifacts.require("./TToken.sol");
const Redeem = artifacts.require("./MerkleRedeem.sol");
const { utils } = web3;
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { increaseTime } = require("./helpers");
const truffleAssert = require("truffle-assertions");

function createMerkleTree(elements) {
  return new MerkleTree(elements, keccak256, {
    hashLeaves: false,
    sortPairs: true
  });
}

contract("MerkleRedeem", accounts => {
  const admin = accounts[0];
  const BYTES32_0 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  let redeem;
  let REDEEM;

  let tbal;
  let TBAL;
  let SEEDER_ROLE;
  let PAUSER_ROLE;

  beforeEach(async () => {
    tbal = await TToken.new("Test Bal", "TBAL", 18);
    await tbal.mint(admin, utils.toWei("1450000"));
    TBAL = tbal.address;
  });

  describe("construction with a non-zero global delay", () => {
    let root;
    let now;
    const dayInSeconds = 86400;
    beforeEach(async () => {
      redeem = await Redeem.new(TBAL, dayInSeconds);

      SEEDER_ROLE = await redeem.SEEDER_ROLE();
      await redeem.grantRole(SEEDER_ROLE, admin);
      REDEEM = redeem.address;
      const claimBalance = utils.toWei("9876");
      const elements = [utils.soliditySha3(accounts[0], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      root = merkleTree.getHexRoot();

      await tbal.mint(REDEEM, utils.toWei("1449999"));
      const lastBlock = await web3.eth.getBlock("latest");
      now = lastBlock.timestamp;
    });
    it("cannot publish a distribution that is claimable before the global delay", async () => {
      await truffleAssert.reverts(
        redeem.seedDistribution(1, root, now),
        "Delay is too short"
      );
    });
    it("can publish a distribution that is observes the delay", async () => {
      // the last additional 1 is needed to account for the timestamp of
      // the block about to be mined
      await redeem.seedDistribution(1, root, now + dayInSeconds + 1);
    });
  });
  describe("construction with no delay", () => {
    beforeEach(async () => {
      redeem = await Redeem.new(TBAL, 0);

      SEEDER_ROLE = await redeem.SEEDER_ROLE();
      await redeem.grantRole(SEEDER_ROLE, admin);
      REDEEM = redeem.address;

      await tbal.mint(REDEEM, utils.toWei("1449999"));
    });
    it("cannot store an allocation without the SEEDER_ROLE", async () => {
      await redeem.revokeRole(SEEDER_ROLE, admin);
      const claimBalance = utils.toWei("9876");
      const lastBlock = await web3.eth.getBlock("latest");
      const now = lastBlock.timestamp;
      const elements = [utils.soliditySha3(accounts[0], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();
      await truffleAssert.reverts(
        redeem.seedDistribution(1, root, now),
        "Must have SEEDER_ROLE"
      );
    });

    it("stores an allocation", async () => {
      const claimBalance = utils.toWei("9876");
      const lastBlock = await web3.eth.getBlock("latest");
      const now = lastBlock.timestamp;

      const elements = [utils.soliditySha3(accounts[0], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();
      await redeem.seedDistribution(1, root, now + 1);

      const proof = merkleTree.getHexProof(elements[0]);

      const result = await redeem.verifyClaim(
        accounts[0],
        1,
        claimBalance,
        proof
      );
      assert(result, "user should have an allocation");
    });

    it("doesn't allow an allocation to be overwritten", async () => {
      const claimBalance = utils.toWei("9876");
      const lastBlock = await web3.eth.getBlock("latest");
      const now = lastBlock.timestamp;

      const elements = [utils.soliditySha3(accounts[0], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();

      await redeem.seedDistribution(1, root, now + 1);

      // construct tree to attempt to override the allocation
      const root2 = merkleTree.getHexRoot();

      await truffleAssert.reverts(
        redeem.seedDistribution(1, root2, now),
        "cannot rewrite merkle root"
      );
    });

    it("stores multiple allocations", async () => {
      const lastBlock = await web3.eth.getBlock("latest");
      const now = lastBlock.timestamp;

      const claimBalance0 = utils.toWei("1000");
      const claimBalance1 = utils.toWei("2000");

      const elements = [
        utils.soliditySha3(accounts[0], claimBalance0),
        utils.soliditySha3(accounts[1], claimBalance1)
      ];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();

      await redeem.seedDistribution(1, root, now + 1);

      const proof0 = merkleTree.getHexProof(elements[0]);
      let result = await redeem.verifyClaim(
        accounts[0],
        1,
        claimBalance0,
        proof0
      );
      assert(result, "account 0 should have an allocation");

      const proof1 = merkleTree.getHexProof(elements[1]);
      result = await redeem.verifyClaim(accounts[1], 1, claimBalance1, proof1);
      assert(result, "account 1 should have an allocation");
    });

    describe("With a week finished", () => {
      const claimBalance = utils.toWei("1000");
      const elements = [utils.soliditySha3(accounts[1], claimBalance)];
      const merkleTree = createMerkleTree(elements);

      it("Reverts when the user attempts to claim before an allocation is produced", async () => {
        await increaseTime(9);
        const claimedBalance = utils.toWei("1000");

        const merkleProof = merkleTree.getHexProof(elements[0]);
        await truffleAssert.reverts(
          redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
            from: accounts[1]
          }),
          "Incorrect merkle proof"
        );
      });
    });

    describe("PAUSER_ROLE", () => {
      const claimBalance = utils.toWei("1000");
      const elements = [utils.soliditySha3(accounts[1], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();

      let claimTime;

      beforeEach(async () => {
        const lastBlock = await web3.eth.getBlock("latest");
        claimTime = lastBlock.timestamp + 200;
        await redeem.seedDistribution(1, root, claimTime);
        PAUSER_ROLE = await redeem.PAUSER_ROLE();
      });
      it("cannot call removeDistribution without the PAUSER_ROLE", async () => {
        await truffleAssert.reverts(
          redeem.removeDistribution(1),
          "Must have PAUSER_ROLE"
        );
      });
      it("cannot modify the global delay without the PAUSER_ROLE", async () => {
        await truffleAssert.reverts(
          redeem.changeMinimumDelay(123456),
          "Must have PAUSER_ROLE"
        );
      });
      describe("authorized pauser role holder", async () => {
        beforeEach(async () => {
          await redeem.grantRole(PAUSER_ROLE, admin);
        });
        it("pauses a distribution by resetting the root to zero", async () => {
          const originalClaimTime = await redeem.claimTimes(1);
          await redeem.removeDistribution(1);
          const claimTime = await redeem.claimTimes(1);
          assert(
            claimTime.toString() === originalClaimTime.toString(),
            "claim time should be unchanged"
          );
          const [root] = await redeem.merkleRoots(1, 1);
          assert(root === BYTES32_0);
          const claimedBalance = utils.toWei("1000");

          const merkleProof = merkleTree.getHexProof(elements[0]);
          await truffleAssert.reverts(
            redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
              from: accounts[1]
            }),
            "Distribution still paused"
          );
        });
        it("cannot pause a live distribution", async () => {
          await increaseTime(1);
          await truffleAssert.reverts(
            redeem.removeDistribution(1),
            "Can't modify a live distribution"
          );
        });
        it("cannot delay a non-existent distribution", async () => {
          await truffleAssert.reverts(
            redeem.removeDistribution(2),
            "Can't modify a live distribution"
          );
        });
        it("can claim after a new root is published", async () => {
          await redeem.removeDistribution(1);
          const claimedBalance = utils.toWei("1000");

          const merkleProof = merkleTree.getHexProof(elements[0]);

          const lastBlock = await web3.eth.getBlock("latest");
          const currentTime = lastBlock.timestamp;

          await redeem.seedDistribution(1, root, currentTime + 1);
          await redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
            from: accounts[1]
          });
        });
        it("can enforce the new global minimum delay when republishing a paused distribution", async () => {
          const dayInSeconds = 86400;
          await redeem.changeMinimumDelay(dayInSeconds);
          await redeem.removeDistribution(1);

          const lastBlock = await web3.eth.getBlock("latest");
          const currentTime = lastBlock.timestamp;

          await truffleAssert.reverts(
            redeem.seedDistribution(1, root, currentTime + 1),
            "Delay is too short"
          );
        });
      });
    });

    describe("When a user has an allocation to claim", () => {
      const claimBalance = utils.toWei("1000");
      const elements = [utils.soliditySha3(accounts[1], claimBalance)];
      const merkleTree = createMerkleTree(elements);
      const root = merkleTree.getHexRoot();

      beforeEach(async () => {
        const lastBlock = await web3.eth.getBlock("latest");
        const now = lastBlock.timestamp;

        await redeem.seedDistribution(1, root, now + 1);
      });

      it("Allows the user to claimWeek", async () => {
        const claimedBalance = utils.toWei("1000");
        const merkleProof = merkleTree.getHexProof(elements[0]);
        await redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
          from: accounts[1]
        });

        let result = await tbal.balanceOf(accounts[1]);
        assert(
          result.toString() === claimedBalance,
          "user should have an allocation"
        );

        result = await redeem.claimed(1, accounts[1]);
        assert(result === true, "claim should be marked as claimed");
      });

      it("Doesn't allow a user to claim for another user", async () => {
        await increaseTime(6);
        const claimedBalance = utils.toWei("1000");
        const merkleProof = merkleTree.getHexProof(elements[0]);

        await truffleAssert.reverts(
          redeem.claimWeek(accounts[2], 1, claimedBalance, merkleProof, {
            from: accounts[2]
          }),
          "Incorrect merkle proof"
        );
      });

      it("Reverts when the user attempts to claim the wrong balance", async () => {
        await increaseTime(0);
        const claimedBalance = utils.toWei("666");
        const merkleProof = merkleTree.getHexProof(elements[0]);
        await truffleAssert.reverts(
          redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
            from: accounts[1]
          }),
          "Incorrect merkle proof"
        );
      });

      it("Reverts when the user attempts to claim twice", async () => {
        await increaseTime(6);
        const claimedBalance = utils.toWei("1000");
        const merkleProof = merkleTree.getHexProof(elements[0]);

        await redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
          from: accounts[1]
        });

        await truffleAssert.reverts(
          redeem.claimWeek(accounts[1], 1, claimedBalance, merkleProof, {
            from: accounts[1]
          }),
          "Already claimed"
        );
      });
    });

    describe("When a user has several allocations to claim", () => {
      const claimBalance1 = utils.toWei("1000");
      const elements1 = [utils.soliditySha3(accounts[1], claimBalance1)];
      const merkleTree1 = createMerkleTree(elements1);
      const root1 = merkleTree1.getHexRoot();

      const claimBalance2 = utils.toWei("1234");
      const elements2 = [utils.soliditySha3(accounts[1], claimBalance2)];
      const merkleTree2 = createMerkleTree(elements2);
      const root2 = merkleTree2.getHexRoot();

      beforeEach(async () => {
        let lastBlock = await web3.eth.getBlock("latest");
        let now = lastBlock.timestamp;
        await redeem.seedDistribution(1, root1, now + 1);

        await increaseTime(7);
        lastBlock = await web3.eth.getBlock("latest");
        now = lastBlock.timestamp;
        await redeem.seedDistribution(2, root2, now + 1);
      });

      it("Allows the user to claim once the time has passed", async () => {
        //await increaseTime(8);

        const claimedBalance1 = utils.toWei("1000");
        const claimedBalance2 = utils.toWei("1234");

        const proof1 = merkleTree1.getHexProof(elements1[0]);
        await redeem.claimWeek(accounts[1], 1, claimedBalance1, proof1, {
          from: accounts[1]
        });

        const proof2 = merkleTree2.getHexProof(elements2[0]);
        await redeem.claimWeek(accounts[1], 2, claimedBalance2, proof2, {
          from: accounts[1]
        });

        const result = await tbal.balanceOf(accounts[1]);
        assert(
          result.toString() === utils.toWei("2234"),
          "user should receive all tokens, including current week"
        );
      });

      it("Allows the user to claim multiple weeks at once", async () => {
        await increaseTime(8);

        const claimedBalance1 = utils.toWei("1000");
        const claimedBalance2 = utils.toWei("1234");

        const proof1 = merkleTree1.getHexProof(elements1[0]);
        const proof2 = merkleTree2.getHexProof(elements2[0]);

        await redeem.claimWeeks(
          accounts[1],
          [[1, claimedBalance1, proof1], [2, claimedBalance2, proof2]],
          { from: accounts[1] }
        );

        const result = await tbal.balanceOf(accounts[1]);
        assert(
          result.toString() === utils.toWei("2234"),
          "user should receive all tokens, including current week"
        );
      });

      it("Returns an array of week claims", async () => {
        let expectedResult = [false, false];
        let result = await redeem.claimStatus(accounts[1], 1, 2);
        assert.deepEqual(
          result,
          expectedResult,
          "claim status should be accurate"
        );
        const claimedBalance1 = utils.toWei("1000");
        const proof1 = merkleTree1.getHexProof(elements1[0]);

        await increaseTime(8);
        await redeem.claimWeeks(accounts[1], [[1, claimedBalance1, proof1]], {
          from: accounts[1]
        });

        expectedResult = [true, false];
        result = await redeem.claimStatus(accounts[1], 1, 2);
        assert.deepEqual(
          result,
          expectedResult,
          "claim status should be accurate"
        );
      });

      it("Returns an array of merkle roots", async () => {
        const expectedResult = [root1, root2];
        const result = await redeem.merkleRoots(1, 2);
        assert.deepEqual(
          result,
          expectedResult,
          "claim status should be accurate"
        );
      });
    });
    describe("withdraw funds", () => {
      it("allows admin to reclaim undistributed funds", async () => {
        const adminBalance = await tbal.balanceOf(accounts[0]);
        await redeem.withdrawFunds(utils.toWei("1000"));
        const expectedNewBalance = adminBalance.add(
          new utils.BN(utils.toWei("1000"))
        );
        const newBalance = await tbal.balanceOf(accounts[0]);
        assert(newBalance.toString() === expectedNewBalance.toString());
      });
      it("cannot be invoked by a non-admin", async () => {
        await truffleAssert.reverts(
          redeem.withdrawFunds(utils.toWei("1000"), { from: accounts[1] }),
          "Must have DEFAULT_ADMIN_ROLE"
        );
      });
    });
  });
});
