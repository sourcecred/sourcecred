// @flow

/**
 * A distribution over the integers `0` through `n - 1`, where `n` is
 * the length of the array. The value at index `i` is the probability of
 * `i` in the distribution. The values should sum to 1.
 */
export type Distribution = Float64Array;

/**
 * A representation of a sparse transition matrix that is convenient for
 * computations on Markov chains.
 *
 * A Markov chain has nodes indexed from `0` to `n - 1`, where `n` is
 * the length of the chain. The elements of the chain represent the
 * incoming edges to each node. Specifically, for each node `v`, the
 * in-degree of `v` equals the length of both `chain[v].neighbor` and
 * `chain[v].weight`. For each `i` from `0` to the degree of `v`
 * (exclusive), there is an edge to `v` from `chain[v].neighbor[i]` with
 * weight `chain[v].weight[i]`.
 *
 * In other words, `chain[v]` is a sparse-vector representation of
 * column `v` of the transition matrix of the Markov chain.
 */
export type SparseMarkovChain = $ReadOnlyArray<{|
  +neighbor: Uint32Array,
  +weight: Float64Array,
|}>;
