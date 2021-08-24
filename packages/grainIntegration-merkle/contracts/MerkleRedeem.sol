pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleRedeem is AccessControl {
    bytes32 public constant DELAYER_ROLE = keccak256("DELAYER_ROLE");
    bytes32 public constant SEEDER_ROLE = keccak256("SEEDER_ROLE");

    IERC20 public token;

    event Claimed(address _contributor, uint256 _balance);

    // Recorded Distributions
    mapping(uint => bytes32) public distributionMerkleRoots;
    mapping(uint => mapping(address => bool)) public claimed;
    mapping(uint => uint64) public claimTimes;

    constructor(
        address _token
    ) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

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
            require(token.transfer(_contributor, _balance), "ERR_TRANSFER_FAILED");
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
        require(!claimed[_distribution][_contributor]);
        require(block.timestamp > claimTimes[_distribution], "Distribution Still Paused");
        require(verifyClaim(_contributor, _distribution, _claimedBalance, _merkleProof), 'Incorrect merkle proof');

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
      *       a claimWeeks function.
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

            require(block.timestamp > claimTimes[claim.distributionIdx], "Distribution Still Delayed");
            require(!claimed[claim.distributionIdx][_contributor]);
            require(verifyClaim(_contributor, claim.distributionIdx, claim.balance, claim.merkleProof), 'Incorrect merkle proof');

            totalBalance += claim.balance;
            claimed[claim.distributionIdx][_contributor] = true;
        }
        disburse(_contributor, totalBalance);
    }

    /**
     * Get the claim status for a user for a slice of distributions.
     * This will error if an index for non-existent distribution is
     * passed.
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
     * distributions. This will error if an index for a non-existent
     * distribution is passed.
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
     * but this may not be the case when ultimately released. Allocations
     * might need to observe some minimum delay period before claims
     * can successfully execute against it.
     */
    function seedAllocations(
        uint _distribution,
        bytes32 _merkleRoot,
        uint64 _claimTime
    )
        external
    {
        require(hasRole(SEEDER_ROLE, msg.sender), "MerkleRedeem: Must have Seeder role to post allocation roots");
        require(distributionMerkleRoots[_distribution] == bytes32(0), "cannot rewrite merkle root");
        distributionMerkleRoots[_distribution] = _merkleRoot;
        claimTimes[_distribution] = _claimTime;
    }

    /**
     * Passing a zero will delay the claim until MAX_UINT64, which is
     * July 21, 2554
     */
    function delayDistribution(uint _distribution, uint64 _newClaimTime) external {
        require(hasRole(DELAYER_ROLE, msg.sender), "MerkleRedeem: Must have pauser role to modify allocations");
        require(distributionMerkleRoots[_distribution] != bytes32(0), "MerkleRedeem: cannot delay a non-existent distribution");
        // It seems unfair to pause a live distribution. This probably warrants
        // further discussion, but I'd hate to prevent some people from
        // rightfully claiming funds and not others.
        require(block.timestamp < claimTimes[_distribution], "MerkleRedeem: Can't Delay a Live Distribution");

        if(_newClaimTime == 0) {
          _newClaimTime = uint64(-1);
        }
        // The below `require` might not be necessary, and in fact might
        // inhibit some desired user stories, where the `DELAYER_ROLE` holder
        // has the authority to reauthorize a distribution.
        require(_newClaimTime > claimTimes[_distribution], "MerkleRedeem: Delayed Claim Time must be in the future");
        claimTimes[_distribution] = _newClaimTime;
    }
}
