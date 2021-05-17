// @flow

import {
  type Distribution,
  uniformDistribution,
  computeDelta,
} from "./distribution";
import {
  type SparseMarkovChain,
  findStationaryDistribution,
  sparseMarkovChainAction,
  sparseMarkovChainFromTransitionMatrix,
  type StationaryDistributionResult,
  type PagerankParams,
} from "./markovChain";

describe("core/algorithm/markovChain", () => {
  /** A distribution that is 1 at the chosen index, and 0 elsewhere.*/
  function singleIndexDistribution(size: number, index: number): Distribution {
    if (!isFinite(size) || size !== Math.floor(size) || size <= 0) {
      throw new Error("size: expected positive integer, but got: " + size);
    }
    if (!isFinite(index) || index !== Math.floor(index) || index < 0) {
      throw new Error("index: expected nonnegative integer, got: " + index);
    }
    if (index >= size) {
      throw new Error("index out of range");
    }
    const distribution = new Float64Array(size);
    distribution[index] = 1;

    return distribution;
  }

  describe("sparseMarkovChainFromTransitionMatrix", () => {
    it("works for a simple matrix", () => {
      const matrix = [
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ];
      const chain = sparseMarkovChainFromTransitionMatrix(matrix);
      const expected = [
        {
          neighbor: new Uint32Array([0, 1, 2]),
          weight: new Float64Array([1, 0.25, 0.25]),
        },
        {
          neighbor: new Uint32Array([2]),
          weight: new Float64Array([0.75]),
        },
        {
          neighbor: new Uint32Array([1]),
          weight: new Float64Array([0.75]),
        },
      ];
      expect(chain).toEqual(expected);
    });

    it("works for the 1-by-1 identity matrix", () => {
      const matrix = [[1]];
      const chain = sparseMarkovChainFromTransitionMatrix(matrix);
      const expected = [
        {
          neighbor: new Uint32Array([0]),
          weight: new Float64Array([1]),
        },
      ];
      expect(chain).toEqual(expected);
    });

    it("works for the 0-by-0 identity matrix", () => {
      const matrix = [];
      const chain = sparseMarkovChainFromTransitionMatrix(matrix);
      const expected = [];
      expect(chain).toEqual(expected);
    });

    it("rejects a ragged matrix", () => {
      const matrix = [[1], [0.5, 0.5]];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /length/
      );
    });

    it("rejects a matrix with negative entries", () => {
      const matrix = [
        [1, 0, 0],
        [-0.5, 0.75, 0.75],
        [0, 0, 1],
      ];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /positive real.*-0.5/
      );
    });

    it("rejects a matrix with NaN entries", () => {
      const matrix = [[NaN]];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /positive real.*NaN/
      );
    });

    it("rejects a matrix with infinite entries", () => {
      const matrix = [[Infinity]];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /positive real.*Infinity/
      );
    });

    it("rejects a non-stochastic matrix", () => {
      const matrix = [
        [1, 0],
        [0.125, 0.625],
      ];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /sums to 0.75/
      );
    });
  });

  describe("sparseMarkovChainAction", () => {
    it("acts properly on a nontrivial chain", () => {
      // Note: this test case uses only real numbers that are exactly
      // representable as floating point numbers.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);

      const alpha = 0;
      const seed = uniformDistribution(chain.length);
      const pi0 = new Float64Array([0.125, 0.375, 0.625]);
      const pi1 = sparseMarkovChainAction(chain, seed, alpha, pi0);
      // The expected value is given by `pi0 * A`, where `A` is the
      // transition matrix. In Octave:
      // >> A = [ 1 0 0; 0.25 0 0.75 ; 0.25 0.75 0 ];
      // >> pi0 = [ 0.125 0.375 0.625 ];
      // >> pi1 = pi0 * A;
      // >> disp(pi1)
      //    0.37500   0.46875   0.28125
      const expected = new Float64Array([0.375, 0.46875, 0.28125]);
      expect(pi1).toEqual(expected);
    });

    it("acts properly on a nontrivial chain with seed and non-zero alpha", () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);

      const alpha = 0.5;
      const seed = singleIndexDistribution(chain.length, 0);
      const pi0 = new Float64Array([0.6, 0.2, 0.2]);
      const pi1 = sparseMarkovChainAction(chain, seed, alpha, pi0);
      // The result is `(1-alpha) * pi0 * A + alpha * seed`,
      // where `A` is the transition matrix.
      const expected = new Float64Array([0.85, 0.075, 0.075]);
      expectAllClose(pi1, expected);
    });
  });

  function expectAllClose(
    actual: Float64Array,
    expected: Float64Array,
    epsilon: number = 1e-6
  ): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      if (Math.abs(actual[i] - expected[i]) >= epsilon) {
        expect(actual).toEqual(expected); // will fail
        return;
      }
    }
  }

  function expectStationary(
    chain: SparseMarkovChain,
    seed: Distribution,
    alpha: number,
    pi: Distribution
  ): void {
    expectAllClose(sparseMarkovChainAction(chain, seed, alpha, pi), pi);
  }

  describe("findStationaryDistribution", () => {
    function validateConvergenceDelta(
      chain: SparseMarkovChain,
      seed: Distribution,
      alpha: number,
      d: StationaryDistributionResult
    ) {
      const nextPi = sparseMarkovChainAction(chain, seed, alpha, d.pi);
      expect(d.convergenceDelta).toEqual(computeDelta(d.pi, nextPi));
    }

    const standardOptions = () => ({
      maxIterations: 255,
      convergenceThreshold: 1e-7,
      verbose: false,
      yieldAfterMs: 1,
    });

    it("finds an all-accumulating stationary distribution", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);
      const params: PagerankParams = {
        chain,
        alpha: 0,
        seed: uniformDistribution(chain.length),
        pi0: uniformDistribution(chain.length),
      };
      const result = await findStationaryDistribution(
        params,
        standardOptions()
      );
      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvergenceDelta(params.chain, params.seed, params.alpha, result);

      expectStationary(params.chain, params.seed, params.alpha, result.pi);
      const expected = new Float64Array([1, 0, 0]);
      expectAllClose(result.pi, expected);
    });

    // Node 0 is the "center"; nodes 1 through 4 are "satellites". A
    // satellite transitions to the center with probability 0.5, or to a
    // cyclically adjacent satellite with probability 0.25 each. The
    // center transitions to a uniformly random satellite.
    const satelliteChain = () =>
      sparseMarkovChainFromTransitionMatrix([
        [0, 0.25, 0.25, 0.25, 0.25],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
      ]);

    it("finds a stationary distribution", async () => {
      const chain = satelliteChain();
      const params: PagerankParams = {
        chain,
        alpha: 0,
        seed: uniformDistribution(chain.length),
        pi0: uniformDistribution(chain.length),
      };
      const result = await findStationaryDistribution(
        params,
        standardOptions()
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvergenceDelta(params.chain, params.seed, params.alpha, result);

      expectStationary(params.chain, params.seed, params.alpha, result.pi);
      const expected = new Float64Array([1 / 3, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
      expectAllClose(result.pi, expected);
    });

    it("finds the same stationary distribution regardless of initialDistribution", async () => {
      const chain = satelliteChain();
      const alpha = 0.1;
      const seed = uniformDistribution(chain.length);
      const initialDistribution1 = singleIndexDistribution(chain.length, 0);
      const params1 = {chain, alpha, seed, pi0: initialDistribution1};
      const initialDistribution2 = singleIndexDistribution(chain.length, 1);
      const params2 = {chain, alpha, seed, pi0: initialDistribution2};

      const result1 = await findStationaryDistribution(
        params1,
        standardOptions()
      );

      const result2 = await findStationaryDistribution(
        params2,
        standardOptions()
      );

      expectAllClose(result1.pi, result2.pi);
    });

    it("finds a non-degenerate stationary distribution with seed and non-zero alpha", async () => {
      const chain = satelliteChain();
      const alpha = 0.1;
      const seed = singleIndexDistribution(chain.length, 0);
      const pi0 = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {chain, alpha, seed, pi0},
        standardOptions()
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvergenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
      const expected = new Float64Array([
        22 / 58,
        9 / 58,
        9 / 58,
        9 / 58,
        9 / 58,
      ]);
      expectAllClose(result.pi, expected);
    });

    it("converges immediately when initialDistribution equals the stationary distribution", async () => {
      const chain = satelliteChain();
      const alpha = 0.1;
      const seed = singleIndexDistribution(chain.length, 0);
      // determine the expected stationary distribtution via Linear algebra
      // from python3:
      // >>A = np.matrix([[0, 0.25, 0.25, 0.25, 0.25],
      //  [0.5, 0, 0.25, 0, 0.25],
      //  [0.5, 0.25, 0, 0.25, 0],
      //  [0.5, 0, 0.25, 0, 0.25],
      //  [0.5, 0.25, 0, 0.25, 0]])
      // >>seed = np.array([1, 0, 0, 0, 0])
      // >>n = len(seed)
      // >>alpha = .1
      // >>piStar = alpha * seed * np.linalg.inv(np.eye(n) -(1-alpha)*A)
      // >>print(piStar)
      const expected = new Float64Array([
        0.37931034,
        0.15517241,
        0.15517241,
        0.15517241,
        0.15517241,
      ]);

      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0: expected,
        },
        standardOptions()
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvergenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
      expectAllClose(result.pi, expected);
    });

    it("finds the stationary distribution of a periodic chain", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 1],
        [1, 0],
      ]);
      const params: PagerankParams = {
        chain,
        alpha: 0,
        seed: uniformDistribution(chain.length),
        pi0: uniformDistribution(chain.length),
      };
      const result = await findStationaryDistribution(
        params,
        standardOptions()
      );

      expect(result.convergenceDelta).toEqual(0);
      validateConvergenceDelta(params.chain, params.seed, params.alpha, result);

      expectStationary(params.chain, params.seed, params.alpha, result.pi);
      const expected = new Float64Array([0.5, 0.5]);
      expectAllClose(result.pi, expected);
    });

    it("returns initial distribution if maxIterations===0", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 1],
        [0, 1],
      ]);
      const params: PagerankParams = {
        chain,
        alpha: 0,
        seed: uniformDistribution(chain.length),
        pi0: uniformDistribution(chain.length),
      };
      const result = await findStationaryDistribution(params, {
        ...standardOptions(),
        maxIterations: 0,
      });
      const expected = new Float64Array([0.5, 0.5]);
      expect(result.pi).toEqual(expected);
      validateConvergenceDelta(params.chain, params.seed, params.alpha, result);
    });

    it("is linear in choice of seed vector", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 0.1;
      const seed1 = singleIndexDistribution(chain.length, 0);
      const seed2 = singleIndexDistribution(chain.length, 1);
      const seedUniform = uniformDistribution(chain.length);
      const pi0 = uniformDistribution(chain.length);

      const result1 = await findStationaryDistribution(
        {chain, seed: seed1, alpha, pi0},
        standardOptions()
      );

      const result2 = await findStationaryDistribution(
        {chain, seed: seed2, alpha, pi0},
        standardOptions()
      );
      const resultUniform = await findStationaryDistribution(
        {chain, seed: seedUniform, alpha, pi0},
        standardOptions()
      );

      function addDistributions(
        d1: Distribution,
        d2: Distribution
      ): Distribution {
        if (d1.length !== d2.length) {
          throw new Error("Can't add distributions of different sizes.");
        }
        const newDistribution = new Float64Array(d1.length);
        for (let i = 0; i < newDistribution.length; i++) {
          newDistribution[i] = d1[i] + d2[i];
        }
        return newDistribution;
      }

      function scaleDistribution(
        scalar: number,
        d: Distribution
      ): Distribution {
        const newDistribution = new Float64Array(d.length);
        for (let i = 0; i < newDistribution.length; i++) {
          newDistribution[i] = scalar * d[i];
        }
        return newDistribution;
      }

      const combined = addDistributions(result1.pi, result2.pi);

      expectAllClose(scaleDistribution(2, resultUniform.pi), combined);
    });

    it("ignores seed when alpha is zero", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 0;
      const seed1 = singleIndexDistribution(chain.length, 0);
      const seed2 = singleIndexDistribution(chain.length, 1);
      const pi0 = uniformDistribution(chain.length);

      const result1 = await findStationaryDistribution(
        {
          chain,
          seed: seed1,
          alpha,
          pi0,
        },
        standardOptions()
      );
      const result2 = await findStationaryDistribution(
        {
          chain,
          seed: seed2,
          alpha,
          pi0,
        },
        standardOptions()
      );
      expectAllClose(result1.pi, result2.pi);
    });

    it("returns seed when alpha is one", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 1;
      const seed = singleIndexDistribution(chain.length, 0);
      const pi0 = uniformDistribution(chain.length);

      const result = await findStationaryDistribution(
        {chain, seed, alpha, pi0},
        standardOptions()
      );
      expectAllClose(result.pi, seed);
    });

    it("does not mutate seed or pi0", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 0.2;
      const seed = singleIndexDistribution(chain.length, 0);
      const pi0 = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {chain, seed, alpha, pi0},
        standardOptions()
      );
      expect(pi0).toEqual(uniformDistribution(chain.length));
      expect(seed).toEqual(singleIndexDistribution(chain.length, 0));
      expect(result).not.toEqual(pi0);
    });
  });
});
