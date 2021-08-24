# Merkle Distribution Grain Integration

#### ⚠️ This contract is still under active development ⚠️

## How It Works

`MerkleReem` is heavily based on [work from balancer](https://github.com/balancer-labs/erc20-redeemable)
and is a scalable way to distribute rewards in the form of an ERC20 on an EVM
blockchain. There are 3 roles:

- `DEFAULT_ADMIN`: Assigned to the deployer of the contract. This role
  is responsible for managing the below two roles
- `SEEDER_ROLE`: Manually assigned and managed by the `DEFAULT_ADMIN`
  role. Responsible for publishing distributions on chain using the
  `seedAllocations` function.
- `DELAYER_ROLE`: Manually assigned and managed by the `DEFAULT_ADMIN`
  role. Responsible for delaying or canceling a distribution.

## Process

0. Any entity can send funds to the contract to be distributed.
1. An actor with the `SEEDER_ROLE` publishes the merkle root for a tree of
   contributors and the grain they earned. A delay is set for each
   distribution to givethe community time to validate the distribution.
1. If the distribution is invalid, or requires further investigation,
   Entities with the `DELAYER_ROLE` can delay the distribution further, or
   effectively cancel it by delaying it until `MAX_UINT64`, which is about
   year 2550 when decoded.
1. Users can claim their distributed funds. Claims are validated against the
   merkle root published on the contract. Users can claim their portion
   of multiple distributions in a single transaction.

## Future Additions

These are top-of-mind features that are worth considering beyond this initial
implementation.

- A permissioned function to transfer undistributed funds out of the contract
- A global `MIN_DELAY` state variable that the `SEEDER_ROLE` must observe
  when publishing a distribution.
