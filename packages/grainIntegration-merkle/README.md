# Merkle Distribution Grain Integration

#### ⚠️ This contract is still under active development ⚠️

## How It Works

`MerkleReem` is heavily based on [work from balancer][balancer]
and is a scalable way to distribute rewards in the form of an ERC20 on an EVM
blockchain. There are 3 roles:

- `DEFAULT_ADMIN`: Assigned to the deployer of the contract. This role
  is responsible for managing the below two roles
- `SEEDER_ROLE`: Manually assigned and managed by the `DEFAULT_ADMIN`
  role. Responsible for publishing distributions on chain using the
  `seedAllocations` function.
- `PAUSER_ROLE`: Manually assigned and managed by the `DEFAULT_ADMIN`
  role. Responsible for pausing a distribution, which can be unpaused.

[balancer]: https://github.com/balancer-labs/erc20-redeemable

## Process

1. Any entity can send funds to the contract to be distributed.
2. An actor with the `SEEDER_ROLE` publishes the merkle root for a tree of
   contributors and the grain they earned. A delay is set for each
   distribution to give the community time to validate the distribution.
3. If the distribution is invalid, or requires further investigation,
   entities with the `PAUSER_ROLE` can pause the distribution, which can
   then be unpaused by republishing a merkle root to the same distribution
   and updating the timestamp.
4. Users can claim their distributed funds. Claims are validated against the
   merkle root published on the contract. Users can claim their portion
   of multiple distributions in a single transaction.

## Future Additions

These are top-of-mind features that are worth considering beyond this initial
implementation.

- A permissioned function to transfer undistributed funds out of the contract
- A global `MIN_DELAY` state variable that the `SEEDER_ROLE` must observe
  when publishing a distribution.
