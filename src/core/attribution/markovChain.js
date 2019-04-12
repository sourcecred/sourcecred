// @flow

/**
 * A distribution over the integers `0` through `n - 1`, where `n` is
 * the length of the array. The value at index `i` is the probability of
 * `i` in the distribution. The values should sum to 1.
 */
export type Distribution = Float64Array;

export type StationaryDistributionResult = {|
  // The final distribution after attempting to find the stationary distribution
  // of the Markov chain.
  +pi: Distribution,

  // Reports how close the returned distribution is to being converged.
  //
  // If the convergenceDelta is near zero, then the distribution is well-converged
  // (stationary).
  //
  // Specifically: let `x` be the distribution being returned, and let `x'` be the
  // distribution after one additional Markov action, i.e.
  // `x' = sparseMarkovChainAction(chain, x)`
  // Then the convergence delta is the maximum difference in absolute value between components
  // in `x` and `x'`.
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

/**
 * Distribution that is 1 at the indicator value and 0 elsewhere.
 */
export function indicatorDistribution(
  size: number,
  indicator: number
): Distribution {
  if (!isFinite(size) || size !== Math.floor(size) || size <= 0) {
    throw new Error("size: expected positive integer, but got: " + size);
  }
  if (
    !isFinite(indicator) ||
    indicator !== Math.floor(indicator) ||
    indicator < 0
  ) {
    throw new Error(
      "indicator: expected nonnegative integer, got: " + indicator
    );
  }
  if (indicator >= size) {
    throw new Error("indicator out of range");
  }
  const distribution = new Float64Array(size).fill(0);
  distribution[indicator] = 1;

  return distribution;
}

function sparseMarkovChainActionInto(
  chain: SparseMarkovChain,
  seed: Distribution,
  alpha: number,
  input: Distribution,
  output: Distribution
): void {
  chain.forEach(({neighbor, weight}, dst) => {
    const inDegree = neighbor.length; // (also `weight.length`)
    let probability = alpha * seed[dst];
    for (let i = 0; i < inDegree; i++) {
      const src = neighbor[i];
      probability += (1 - alpha) * input[src] * weight[i];
    }
    output[dst] = probability;
  });
}

export function sparseMarkovChainAction(
  chain: SparseMarkovChain,
  seed: Distribution,
  alpha: number,
  pi: Distribution
): Distribution {
  const result = new Float64Array(pi.length);
  sparseMarkovChainActionInto(chain, seed, alpha, pi, result);
  return result;
}

/**
 * Compute the maximum difference (in absolute value) between components in two
 * distributions.
 *
 * Equivalent to $\norm{pi0 - pi1}_\infty$.
 */
export function computeDelta(pi0: Distribution, pi1: Distribution) {
  let maxDelta = -Infinity;
  // Here, we assume that `pi0.nodeOrder` and `pi1.nodeOrder` are the
  // same (i.e., there has been no permutation).
  pi0.forEach((x, i) => {
    const delta = Math.abs(x - pi1[i]);
    maxDelta = Math.max(delta, maxDelta);
  });
  return maxDelta;
}

function* findStationaryDistributionGenerator(
  chain: SparseMarkovChain,
  seed: Distribution,
  alpha: number,
  initialDistribution: Distribution,
  options: {|
    +verbose: boolean,
    // A distribution is considered stationary if the action of the Markov
    // chain on the distribution does not change any component by more than
    // `convergenceThreshold` in absolute value.
    +convergenceThreshold: number,
    // We will run maxIterations markov chain steps at most.
    +maxIterations: number,
  |}
): Generator<void, StationaryDistributionResult, void> {
  let pi = initialDistribution;
  let scratch = new Float64Array(pi.length);

  let nIterations = 0;
  while (true) {
    if (nIterations >= options.maxIterations) {
      if (options.verbose) {
        console.log(`[${nIterations}] FAILED to converge`);
      }
      // We need to do one more step so that we can compute the empirical convergence
      // delta for the returned distribution.
      sparseMarkovChainActionInto(chain, seed, alpha, pi, scratch);
      const convergenceDelta = computeDelta(pi, scratch);
      return {pi, convergenceDelta};
    }
    nIterations++;
    sparseMarkovChainActionInto(chain, seed, alpha, pi, scratch);
    // We compute the convergenceDelta between 'scratch' (the newest
    // distribution) and 'pi' (the distribution from the previous step). If the
    // delta is below threshold, then the distribution from the last step was
    // already converged and we return it (not scratch). Otherwise, we assign
    // `scratch` to `distribution` and try again.
    const convergenceDelta = computeDelta(pi, scratch);
    if (options.verbose) {
      console.log(`[${nIterations}] delta = ${convergenceDelta}`);
    }
    if (convergenceDelta < options.convergenceThreshold) {
      if (options.verbose) {
        console.log(`[${nIterations}] CONVERGED`);
      }
      return {pi, convergenceDelta};
    }
    [scratch, pi] = [pi, scratch];
    yield;
  }
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("Unreachable.");
}

export function findStationaryDistribution(
  chain: SparseMarkovChain,
  seed: Distribution,
  alpha: number,
  initialDistribution: Distribution,
  options: {|
    +verbose: boolean,
    +convergenceThreshold: number,
    +maxIterations: number,
    +yieldAfterMs: number,
  |}
): Promise<StationaryDistributionResult> {
  let gen = findStationaryDistributionGenerator(
    chain,
    seed,
    alpha,
    initialDistribution,
    {
      verbose: options.verbose,
      convergenceThreshold: options.convergenceThreshold,
      maxIterations: options.maxIterations,
    }
  );
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
