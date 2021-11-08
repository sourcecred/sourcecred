// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleRedeem is AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SEEDER_ROLE = keccak256("SEEDER_ROLE");

    IERC20 public token;
    uint64 public minDelay;

    event Claimed(address indexed _contributor, uint256 _balance);
    event DistributionPublished(uint indexed _id, bytes32 _root);
    event DistributionPaused(uint indexed _id);

    // Recorded Distributions
    mapping(uint => bytes32) public distributionMerkleRoots;
    mapping(uint => mapping(address => bool)) public claimed;
    mapping(uint => uint64) public claimTimes;

    constructor(
        address _token,
        uint64 _minDelay
    ) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        minDelay = _minDelay;
        token = IERC20(_token);
    }

    function disburse(
        address _contributor,
        uint _balance
    )
        private
    {
        if (_balance > 0) {
            emit Claimed(_contributor, _balance);
            require(token.transfer(_contributor, _balance), "MerkleRedeem: ERR_TRANSFER_FAILED");
        }
    }

    /**
      * @dev  ensure the contract's token balance is sufficient before calling
      *       a claimWeek function.
      */
    function claimWeek(
        address _contributor,
        uint _distribution,
        uint _claimedBalance,
        bytes32[] memory _merkleProof
    )
        public
    {
        require(!claimed[_distribution][_contributor], "MerkleRedeem: Already claimed");
        require(block.timestamp > claimTimes[_distribution], "MerkleRedeem: Distribution still paused");
        require(verifyClaim(_contributor, _distribution, _claimedBalance, _merkleProof), 'MerkleRedeem: Incorrect merkle proof');

        claimed[_distribution][_contributor] = true;
        disburse(_contributor, _claimedBalance);
    }

    struct Claim {
        uint distributionIdx;
        uint balance;
        bytes32[] merkleProof;
    }

    /**
      * @dev  ensure the contract's token balance is sufficient before calling
      *       the claimWeeks function.
      */
    function claimWeeks(
        address _contributor,
        Claim[] memory claims
    )
        public
    {
        uint totalBalance = 0;
        Claim memory claim ;
        for(uint i = 0; i < claims.length; i++) {
            claim = claims[i];

            require(block.timestamp > claimTimes[claim.distributionIdx], "MerkleRedeem: Distribution still paused");
            require(!claimed[claim.distributionIdx][_contributor]);
            require(verifyClaim(_contributor, claim.distributionIdx, claim.balance, claim.merkleProof), 'MerkleRedeem: Incorrect merkle proof');

            totalBalance += claim.balance;
            claimed[claim.distributionIdx][_contributor] = true;
        }
        disburse(_contributor, totalBalance);
    }

    /**
     * Get the claim status for a user for a slice of distributions.
     * Will return false for a non-existent distribution.
     *
     * The `_end` value is included in the returned array
     */
    function claimStatus(
        address _contributor,
        uint _begin,
        uint _end
    )
        external
        view
        returns (bool[] memory)
    {
        uint size = 1 + _end - _begin;
        bool[] memory arr = new bool[](size);
        for(uint i = 0; i < size; i++) {
            arr[i] = claimed[_begin + i][_contributor];
        }
        return arr;
    }

    /**
     * Get the bytes32 hash merkle root for a slice of all valid
     * distributions. This will return bytes32(0) if a distribution is
     * paused or non-existent. Non-existent distributions have a `claimTime`
     * of zero.
     *
     * The `_end` value is included in the returned array
     */
    function merkleRoots(
        uint _begin,
        uint _end
    )
        external
        view
        returns (bytes32[] memory)
    {
        uint size = 1 + _end - _begin;
        bytes32[] memory arr = new bytes32[](size);
        for(uint i = 0; i < size; i++) {
            arr[i] = distributionMerkleRoots[_begin + i];
        }
        return arr;
    }

    /**
     *  Check the validity of a claim attempt
     */
    function verifyClaim(
        address _contributor,
        uint _distribution,
        uint _claimedBalance,
        bytes32[] memory _merkleProof
    )
        public
        view
        returns (bool valid)
    {
        bytes32 leaf = keccak256(abi.encodePacked(_contributor, _claimedBalance));
        return MerkleProof.verify(_merkleProof, distributionMerkleRoots[_distribution], leaf);
    }

    /**
     * Publish a merkleRoot that contributors can validate against to claim
     * funds. Currently the _claimTime can be set to any time past or present,
     * but this may not be the case when ultimately released. Distributions
     * might need to observe some minimum delay period before claims
     * can successfully execute against it.
     */
    function seedDistribution(
        uint _distribution,
        bytes32 _merkleRoot,
        uint64 _claimTime
    )
        external
    {
        require(hasRole(SEEDER_ROLE, msg.sender), "MerkleRedeem: Must have SEEDER_ROLE to post allocation roots");
        require(distributionMerkleRoots[_distribution] == bytes32(0), "MerkleRedeem: cannot rewrite merkle root");
        require(block.timestamp + minDelay <= _claimTime, "MerkleRedeem: Delay is too short");
        distributionMerkleRoots[_distribution] = _merkleRoot;
        claimTimes[_distribution] = _claimTime;
        emit DistributionPublished(_distribution, _merkleRoot);
    }

    /**
     * Pause a Distribution by resetting the merkle root to zero
     * The distribution can be re-seeded with a new merkle root.
     * The caller must have the `PAUSER_ROLE` and the distribution cannot be
     * "live", i.e. the `claimTime` cannot have passed.
     *
     * This effectively pauses the distribution indefinitely, since it can
     * still be re-seeded with `seedDistribution`
     */
    function removeDistribution(uint _distribution) external {
        require(hasRole(PAUSER_ROLE, msg.sender), "MerkleRedeem: Must have PAUSER_ROLE to modify allocations");
        require(block.timestamp < claimTimes[_distribution], "MerkleRedeem: Can't modify a live distribution");

        distributionMerkleRoots[_distribution] = bytes32(0);
        emit DistributionPaused(_distribution);
    }

    /**
     * Pauser Role can modify the global minumum delay
     */
    function changeMinimumDelay(uint64 _newDelay) external {
        require(hasRole(PAUSER_ROLE, msg.sender), "MerkleRedeem: Must have PAUSER_ROLE to modify allocations");
        minDelay = _newDelay;
    }

    /**
     *  Used to withdraw unclaimed funds or empty the contract in the event
     *  of an emergency.
     */
    function withdrawFunds(uint _amount) external {
      require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "MerkleRedeem: Must have DEFAULT_ADMIN_ROLE to withdraw funds from the contract");
      require(token.transfer(msg.sender, _amount), "MerkleRedeem: ERR_TRANSFER_FAILED");
    }
}
