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

export function sparseMarkovChainFromTransitionMatrix(
  matrix: $ReadOnlyArray<$ReadOnlyArray<number>>
): SparseMarkovChain {
  const n = matrix.length;
  matrix.forEach((row, i) => {
    if (row.length !== n) {
      throw new Error(
        `expected rows to have length ${n}, but row ${i} has ${row.length}`
      );
    }
  });
  matrix.forEach((row, i) => {
    row.forEach((value, j) => {
      if (isNaN(value) || !isFinite(value) || value < 0) {
        throw new Error(
          `expected positive real entries, but [${i}][${j}] is ${value}`
        );
      }
    });
  });
  matrix.forEach((row, i) => {
    const rowsum = row.reduce((a, b) => a + b, 0);
    if (Math.abs(rowsum - 1) > 1e-6) {
      throw new Error(
        `expected rows to sum to 1, but row ${i} sums to ${rowsum}`
      );
    }
  });
  return matrix.map((_, j) => {
    const column = matrix
      .map((row, i) => [i, row[j]])
      .filter(([_, p]) => p > 0);
    return {
      neighbor: new Uint32Array(column.map(([i, _]) => i)),
      weight: new Float64Array(column.map(([_, p]) => p)),
    };
  });
}

export function uniformDistribution(n: number): Distribution {
  if (isNaN(n) || !isFinite(n) || n !== Math.floor(n) || n <= 0) {
    throw new Error("expected positive integer, but got: " + n);
  }
  return new Float64Array(n).fill(1 / n);
}

export function sparseMarkovChainAction(
  chain: SparseMarkovChain,
  pi: Distribution
): Distribution {
  const result = new Float64Array(pi.length);
  chain.forEach(({neighbor, weight}, dst) => {
    const inDegree = neighbor.length; // (also `weight.length`)
    let probability = 0;
    for (let i = 0; i < inDegree; i++) {
      const src = neighbor[i];
      probability += pi[src] * weight[i];
    }
    result[dst] = probability;
  });
  return result;
}

export function findStationaryDistribution(
  chain: SparseMarkovChain,
  options?: {|
    +verbose?: boolean,
    +convergenceThreshold?: number,
    +maxIterations?: number,
  |}
): Distribution {
  const fullOptions = {
    verbose: false,
    convergenceThreshold: 1e-7,
    maxIterations: 255,
    ...(options || {}),
  };
  let r0 = uniformDistribution(chain.length);
  function computeDelta(pi0, pi1) {
    let maxDelta = -Infinity;
    // Here, we assume that `pi0.nodeOrder` and `pi1.nodeOrder` are the
    // same (i.e., there has been no permutation).
    pi0.forEach((x, i) => {
      const delta = Math.abs(x - pi1[i]);
      maxDelta = Math.max(delta, maxDelta);
    });
    return maxDelta;
  }
  let iteration = 0;
  while (true) {
    if (iteration >= fullOptions.maxIterations) {
      if (fullOptions.verbose) {
        console.log(`[${iteration}] FAILED to converge`);
      }
      return r0;
    }
    iteration++;
    const r1 = sparseMarkovChainAction(chain, r0);
    const delta = computeDelta(r0, r1);
    r0 = r1;
    if (fullOptions.verbose) {
      console.log(`[${iteration}] delta = ${delta}`);
    }
    if (delta < fullOptions.convergenceThreshold) {
      if (fullOptions.verbose) {
        console.log(`[${iteration}] CONVERGED`);
      }
      return r0;
    }
  }
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("Unreachable.");
}
