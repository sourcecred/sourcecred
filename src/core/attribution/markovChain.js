// @flow

/**
 * A distribution over the integers `0` through `n - 1`, where `n` is
 * the length of the array. The value at index `i` is the probability of
 * `i` in the distribution. The values should sum to 1.
 */
export type Distribution = Float64Array;

export type StationaryDistributionResult = {|
  // The final distribution after attempting to find the stationary distribution
  // of the markov chain
  +distribution: Distribution,
  // How many steps were taken in this convergence attempt
  +nIterations: number,
  // The maximum delta between entries in the distribution as of the final
  // markov chain step. If no steps were taken, convergenceDelta will be NaN
  +convergenceDelta: number,
|};

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

function sparseMarkovChainActionInto(
  chain: SparseMarkovChain,
  input: Distribution,
  output: Distribution
): void {
  chain.forEach(({neighbor, weight}, dst) => {
    const inDegree = neighbor.length; // (also `weight.length`)
    let probability = 0;
    for (let i = 0; i < inDegree; i++) {
      const src = neighbor[i];
      probability += input[src] * weight[i];
    }
    output[dst] = probability;
  });
}

export function sparseMarkovChainAction(
  chain: SparseMarkovChain,
  pi: Distribution
): Distribution {
  const result = new Float64Array(pi.length);
  sparseMarkovChainActionInto(chain, pi, result);
  return result;
}

function* findStationaryDistributionGenerator(
  chain: SparseMarkovChain,
  options: {|
    +verbose: boolean,
    // The chain is considered converged once the maximum delta in the
    // distribution is less than convergenceThreshold
    +convergenceThreshold: number,
    // We will run maxIterations markov chain steps at most
    +maxIterations: number,
  |}
): Generator<void, StationaryDistributionResult, void> {
  let distribution = uniformDistribution(chain.length);
  let scratch = new Float64Array(distribution.length);
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
  let nIterations = 0;
  let convergenceDelta = NaN;
  while (true) {
    if (nIterations >= options.maxIterations) {
      if (options.verbose) {
        console.log(`[${nIterations}] FAILED to converge`);
      }
      return {distribution, nIterations, convergenceDelta};
    }
    nIterations++;
    sparseMarkovChainActionInto(chain, distribution, scratch);
    convergenceDelta = computeDelta(distribution, scratch);
    [scratch, distribution] = [distribution, scratch];
    if (options.verbose) {
      console.log(`[${nIterations}] delta = ${convergenceDelta}`);
    }
    if (convergenceDelta < options.convergenceThreshold) {
      if (options.verbose) {
        console.log(`[${nIterations}] CONVERGED`);
      }
      return {distribution, nIterations, convergenceDelta};
    }
    yield;
  }
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("Unreachable.");
}

export function findStationaryDistribution(
  chain: SparseMarkovChain,
  options: {|
    +verbose: boolean,
    +convergenceThreshold: number,
    +maxIterations: number,
    +yieldAfterMs: number,
  |}
): Promise<StationaryDistributionResult> {
  let gen = findStationaryDistributionGenerator(chain, {
    verbose: options.verbose,
    convergenceThreshold: options.convergenceThreshold,
    maxIterations: options.maxIterations,
  });
  return new Promise((resolve, _unused_reject) => {
    const {yieldAfterMs} = options;
    const tick = () => {
      const start = Date.now();
      do {
        const result = gen.next();
        if (result.done) {
          if (result.value == null) {
            // Should never happen.
            throw new Error(String(result.value));
          }
          resolve(result.value);
          return;
        }
      } while (Date.now() - start < yieldAfterMs);
      setTimeout(tick, 0);
    };
    tick();
  });
}
