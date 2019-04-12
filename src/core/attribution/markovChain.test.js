// @flow

import type {Distribution, SparseMarkovChain} from "./markovChain";
import {
  findStationaryDistribution,
  sparseMarkovChainAction,
  sparseMarkovChainFromTransitionMatrix,
  uniformDistribution,
  indicatorDistribution,
  computeDelta,
  type StationaryDistributionResult,
} from "./markovChain";

describe("core/attribution/markovChain", () => {
  describe("sparseMarkovChainFromTransitionMatrix", () => {
    it("works for a simple matrix", () => {
      const matrix = [[1, 0, 0], [0.25, 0, 0.75], [0.25, 0.75, 0]];
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
      const matrix = [[1, 0, 0], [-0.5, 0.75, 0.75], [0, 0, 1]];
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
      const matrix = [[1, 0], [0.125, 0.625]];
      expect(() => sparseMarkovChainFromTransitionMatrix(matrix)).toThrow(
        /sums to 0.75/
      );
    });
  });

  describe("uniformDistribution", () => {
    it("computes the uniform distribution with domain of size 1", () => {
      const pi = uniformDistribution(1);
      expect(pi).toEqual(new Float64Array([1]));
    });
    it("computes the uniform distribution with domain of size 4", () => {
      const pi = uniformDistribution(4);
      expect(pi).toEqual(new Float64Array([0.25, 0.25, 0.25, 0.25]));
    });
    [0, -1, Infinity, NaN, 3.5, '"beluga"', null, undefined].forEach((bad) => {
      it(`fails when given domain ${String(bad)}`, () => {
        expect(() => uniformDistribution((bad: any))).toThrow(
          "positive integer"
        );
      });
    });
  });

  describe("indicatorDistribution", () => {
    it("computes the indicator distribution with domain of size 1", () => {
      const pi = indicatorDistribution(1, 0);
      expect(pi).toEqual(new Float64Array([1]));
    });
    it("computes the indicator distribution with domain of size 4 and source node 0", () => {
      const pi = indicatorDistribution(4, 0);
      expect(pi).toEqual(new Float64Array([1, 0, 0, 0]));
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
      const pi1 = sparseMarkovChainAction({chain, seed, alpha, pi0});
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
      // Note: this test case uses only real numbers that are exactly
      // representable as floating point numbers.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);

      const alpha = 0.5;
      const seed = indicatorDistribution(chain.length, 0);
      const pi0 = new Float64Array([0.6, 0.2, 0.2]);
      const pi1 = sparseMarkovChainAction({chain, seed, alpha, pi0});
      // The expected value is given by `(1-alpha)*pi0 * A + alpha*seed`,
      // where `A` is the transition matrix. In python3:
      // >> A = np.matrix([[ 1, 0, 0], [0.25, 0, 0.75], [0.25, 0.75, 0 ]])
      // >> seed = np.array([1,0,0])
      // >> alpha = .5
      // >> pi0 = np.array([ 0.6, 0.2, 0.2 ])
      // >> pi1 = (1-alpha)*pi0 * A + alpha*seed;
      // >> print(pi1)
      //    [[0.85  0.075 0.075]]
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
    pi0: Distribution
  ): void {
    expectAllClose(sparseMarkovChainAction({chain, seed, alpha, pi0}), pi0);
  }

  describe("findStationaryDistribution", () => {
    function validateConvegenceDelta(
      chain: SparseMarkovChain,
      seed: Distribution,
      alpha: number,
      d: StationaryDistributionResult
    ) {
      const nextPi = sparseMarkovChainAction({chain, seed, alpha, pi0: d.pi});
      expect(d.convergenceDelta).toEqual(computeDelta(d.pi, nextPi));
    }

    it("finds an all-accumulating stationary distribution", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);
      const uniform = uniformDistribution(chain.length);
      const result: StationaryDistributionResult = await findStationaryDistribution(
        {
          chain,
          seed: uniform,
          alpha: 0,
          pi0: uniform,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );
      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, uniform, 0, result);

      expectStationary(chain, uniform, 0, result.pi);
      const expected = new Float64Array([1, 0, 0]);
      expectAllClose(result.pi, expected);
    });

    it("finds a non-degenerate stationary distribution", async () => {
      // Node 0 is the "center"; nodes 1 through 4 are "satellites". A
      // satellite transitions to the center with probability 0.5, or to a
      // cyclically adjacent satellite with probability 0.25 each. The
      // center transitions to a uniformly random satellite.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 0.25, 0.25, 0.25, 0.25],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
      ]);
      const alpha = 0;
      const seed = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0: uniformDistribution(chain.length),
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
      const expected = new Float64Array([1 / 3, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
      expectAllClose(result.pi, expected);
    });

    it("finds a the same stationary distribution regardless of initialDistribution", async () => {
      // Node 0 is the "center"; nodes 1 through 4 are "satellites". A
      // satellite transitions to the center with probability 0.5, or to a
      // cyclically adjacent satellite with probability 0.25 each. The
      // center transitions to a uniformly random satellite.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 0.25, 0.25, 0.25, 0.25],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
      ]);
      const alpha = 0.1;
      const seed = uniformDistribution(chain.length);
      const initialDistribution1 = indicatorDistribution(chain.length, 0);
      const initialDistribution2 = indicatorDistribution(chain.length, 1);

      const result1 = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0: initialDistribution1,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      const result2 = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0: initialDistribution2,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      expectAllClose(result1.pi, result2.pi);
    });

    it("finds a non-degenerate stationary distribution with seed and non-zero alpha", async () => {
      // Node 0 is the "center" and also the seed; nodes 1 through 4 are "satellites". A
      // satellite transitions to the center with probability 0.5, or to a
      // cyclically adjacent satellite with probability 0.25 each. The
      // center transitions to a uniformly random satellite.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 0.25, 0.25, 0.25, 0.25],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
      ]);
      const alpha = 0.1;
      const seed = indicatorDistribution(chain.length, 0);
      const pi0 = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
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
      expectAllClose(result.pi, expected);
    });

    it("converges immediately when initialDistribution equals the stationary distribution", async () => {
      // Node 0 is the "center" and also the seed; nodes 1 through 4 are "satellites". A
      // satellite transitions to the center with probability 0.5, or to a
      // cyclically adjacent satellite with probability 0.25 each. The
      // center transitions to a uniformly random satellite.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0, 0.25, 0.25, 0.25, 0.25],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
        [0.5, 0, 0.25, 0, 0.25],
        [0.5, 0.25, 0, 0.25, 0],
      ]);

      const alpha = 0.1;
      const seed = indicatorDistribution(chain.length, 0);
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

      const pi0 = expected;
      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0,
        },
        {
          maxIterations: 0,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
      expectAllClose(result.pi, expected);
    });

    it("finds the stationary distribution of a periodic chain", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([[0, 1], [1, 0]]);
      const alpha = 0;
      const seed = uniformDistribution(chain.length);
      const pi0 = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      expect(result.convergenceDelta).toEqual(0);
      validateConvegenceDelta(chain, seed, alpha, result);

      expectStationary(chain, seed, alpha, result.pi);
      const expected = new Float64Array([0.5, 0.5]);
      expectAllClose(result.pi, expected);
    });

    it("returns initial distribution if maxIterations===0", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([[0, 1], [0, 1]]);
      const alpha = 0;
      const seed = uniformDistribution(chain.length);
      const pi0 = uniformDistribution(chain.length);
      const result = await findStationaryDistribution(
        {
          chain,
          seed,
          alpha,
          pi0,
        },
        {
          verbose: false,
          convergenceThreshold: 1e-7,
          maxIterations: 0,
          yieldAfterMs: 1,
        }
      );
      const expected = new Float64Array([0.5, 0.5]);
      expect(result.pi).toEqual(expected);
      validateConvegenceDelta(chain, seed, alpha, result);
    });

    it("is linear in choice of seed vector", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 0.1;
      const seed1 = indicatorDistribution(chain.length, 0);
      const seed2 = indicatorDistribution(chain.length, 1);
      const seedUniform = uniformDistribution(chain.length);
      const pi0 = uniformDistribution(chain.length);

      const result1 = await findStationaryDistribution(
        {
          chain,
          seed: seed1,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );

      const result2 = await findStationaryDistribution(
        {
          chain,
          seed: seed2,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );
      const resultUniform = await findStationaryDistribution(
        {
          chain,
          seed: seedUniform,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
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
      const seed1 = indicatorDistribution(chain.length, 0);
      const seed2 = indicatorDistribution(chain.length, 1);
      const pi0 = uniformDistribution(chain.length);

      const result1 = await findStationaryDistribution(
        {
          chain,
          seed: seed1,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );
      const result2 = await findStationaryDistribution(
        {
          chain,
          seed: seed2,
          alpha,
          pi0,
        },
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );
      expectAllClose(result1.pi, result2.pi);
    });

    it("returns seed when alpha is one", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [0.75, 0.25],
        [0.5, 0.5],
      ]);
      const alpha = 1;
      const seed = indicatorDistribution(chain.length, 0);
      const pi0 = uniformDistribution(chain.length);

      const result = await findStationaryDistribution(
        {chain, seed, alpha, pi0},
        {
          maxIterations: 255,
          convergenceThreshold: 1e-7,
          verbose: false,
          yieldAfterMs: 1,
        }
      );
      expectAllClose(result.pi, seed);
    });
  });
});
