pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleRedeem is AccessControl {
    bytes32 public constant DELAYER_ROLE = keccak256("DELAYER_ROLE");
    bytes32 public constant SEEDER_ROLE = keccak256("SEEDER_ROLE");

    IERC20 public token;

    event Claimed(address _claimant, uint256 _balance);

    // Recorded weeks
    mapping(uint => bytes32) public weekMerkleRoots;
    mapping(uint => mapping(address => bool)) public claimed;
    mapping(uint => uint64) public claimTimes;

    constructor(
        address _token
    ) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        token = IERC20(_token);
    }

    function disburse(
        address _liquidityProvider,
        uint _balance
    )
        private
    {
        if (_balance > 0) {
            emit Claimed(_liquidityProvider, _balance);
            require(token.transfer(_liquidityProvider, _balance), "ERR_TRANSFER_FAILED");
        }
    }

    /**
      * @dev  ensure the contract's token balance is sufficient before calling
      *       a claimWeek function.
      */
    function claimWeek(
        address _liquidityProvider,
        uint _week,
        uint _claimedBalance,
        bytes32[] memory _merkleProof
    )
        public
    {
        require(!claimed[_week][_liquidityProvider]);
        require(block.timestamp > claimTimes[_week], "Distribution Still Paused");
        require(verifyClaim(_liquidityProvider, _week, _claimedBalance, _merkleProof), 'Incorrect merkle proof');

        claimed[_week][_liquidityProvider] = true;
        disburse(_liquidityProvider, _claimedBalance);
    }

    struct Claim {
        uint week;
        uint balance;
        bytes32[] merkleProof;
    }

    /**
      * @dev  ensure the contract's token balance is sufficient before calling
      *       a claimWeeks function.
      */
    function claimWeeks(
        address _liquidityProvider,
        Claim[] memory claims
    )
        public
    {
        uint totalBalance = 0;
        Claim memory claim ;
        for(uint i = 0; i < claims.length; i++) {
            claim = claims[i];

            require(block.timestamp > claimTimes[claim.week], "Distribution Still Paused");
            require(!claimed[claim.week][_liquidityProvider]);
            require(verifyClaim(_liquidityProvider, claim.week, claim.balance, claim.merkleProof), 'Incorrect merkle proof');

            totalBalance += claim.balance;
            claimed[claim.week][_liquidityProvider] = true;
        }
        disburse(_liquidityProvider, totalBalance);
    }

    /**
     * Get the claim status for a user for a slice of distributions.
     * This will error if an index for non-existent distribution is
     * passed.
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
            arr[i] = weekMerkleRoots[_begin + i];
        }
        return arr;
    }

    /**
     *  Check the validity of a claim attempt
     */
    function verifyClaim(
        address _liquidityProvider,
        uint _week,
        uint _claimedBalance,
        bytes32[] memory _merkleProof
    )
        public
        view
        returns (bool valid)
    {
        bytes32 leaf = keccak256(abi.encodePacked(_liquidityProvider, _claimedBalance));
        return MerkleProof.verify(_merkleProof, weekMerkleRoots[_week], leaf);
    }

    /**
     * Publish a merkleRoot that contributors an validate against to claim
     * funds. Currently the _claimTime can be set to any time past or present,
     * but this may not be the case when ultimately released. Allocations
     * might need to observe some minimum delay period before claims
     * can successfully execute against it.
     */
    function seedAllocations(
        uint _week,
        bytes32 _merkleRoot,
        uint64 _claimTime
    )
        external
    {
        require(hasRole(SEEDER_ROLE, msg.sender), "MerkleRedeem: Must have Seeder role to post allocation roots");
        require(weekMerkleRoots[_week] == bytes32(0), "cannot rewrite merkle root");
        weekMerkleRoots[_week] = _merkleRoot;
        claimTimes[_week] = _claimTime;
    }

    /**
      * Passing a zero will delay the claim until MAX_UINT64, which is
      * July 21, 2554
      */
    function delayAllocation(uint _week, uint64 _newClaimTime) external {
        require(hasRole(DELAYER_ROLE, msg.sender), "MerkleRedeem: Must have pauser role to modify allocations");
        require(weekMerkleRoots[_week] != bytes32(0), "cannot delay a non-existent distribution");
        // It seems unfair to pause a live distribution. This probably warrants
        // further discussion, but I'd hate to prevent some people from
        // rightfully claiming funds and not others.
        require(block.timestamp < claimTimes[_week], "MerkleRedeem: Can't Delay a Live Distribution");

        if(_newClaimTime == 0) {
          _newClaimTime = uint64(-1);
        }
        // The below `require` might not be necessary, and in fact might hinder
        // some desired user stories, where the `PAUSER_ROLE` holder has the
        // authority to reauthorize a distribution.
        require(_newClaimTime > claimTimes[_week], "MerkleRedeem: Delayed Claim Time must be in the future");
        claimTimes[_week] = _newClaimTime;
    }
}
