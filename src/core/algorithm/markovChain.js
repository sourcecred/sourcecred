// @flow

import {computeDelta, type Distribution} from "./distribution";
/**
 * The data inputs to running PageRank.
 *
 * We keep these separate from the PagerankOptions below,
 * because we expect that within a given context, every call to
 * findStationaryDistribution (or other Pagerank functions) will
 * have different PagerankParams, but often have the same PagerankOptions.
 */
export type PagerankParams = {|
  // The Markov Chain to run PageRank on.
  +chain: SparseMarkovChain,
  // The initial distribution to start from.
  +pi0: Distribution,
  // The seed vector that PageRank 'teleports' back to.
  +seed: Distribution,
  // The probability of teleporting back to the seed vector.
  // If alpha=0, then the seed vector is irrelevant.
  // If alpha=1, then it trivially converges to the seed vector.
  +alpha: number,
|};

/**
 * PagerankOptions allows the user to tweak PageRank's behavior, especially around
 * convergence.
 */
export type PagerankOptions = {|
  // Causes runtime information to get logged to console.
  +verbose: boolean,
  // A distribution is considered stationary if the action of the Markov
  // chain on the distribution does not change any component by more than
  // `convergenceThreshold` in absolute value.
  +convergenceThreshold: number,
  // We will run maxIterations markov chain steps at most.
  +maxIterations: number,
  // To prevent locking the rest of the application, PageRank will yield control
  // after this many miliseconds, allowing UI updates, etc.
  +yieldAfterMs: number,
|};

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

function* findStationaryDistributionGenerator(
  params: PagerankParams,
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
  const {chain, pi0, seed, alpha} = params;
  let pi = new Float64Array(pi0);
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
  params: PagerankParams,
  options: PagerankOptions
): Promise<StationaryDistributionResult> {
  const gen = findStationaryDistributionGenerator(params, {
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
