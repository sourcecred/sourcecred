// @flow

import type {Distribution, SparseMarkovChain} from "./markovChain";
import {
  findStationaryDistribution,
  sparseMarkovChainAction,
  sparseMarkovChainFromTransitionMatrix,
  uniformDistribution,
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

  describe("sparseMarkovChainAction", () => {
    it("acts properly on a nontrivial chain", () => {
      // Note: this test case uses only real numbers that are exactly
      // representable as floating point numbers.
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);
      const pi0 = new Float64Array([0.125, 0.375, 0.625]);
      const pi1 = sparseMarkovChainAction(chain, pi0);
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

  function expectStationary(chain: SparseMarkovChain, pi: Distribution): void {
    expectAllClose(sparseMarkovChainAction(chain, pi), pi);
  }

  describe("findStationaryDistribution", () => {
    function validateConvegenceDelta(chain, d: StationaryDistributionResult) {
      const nextPi = sparseMarkovChainAction(chain, d.pi);
      expect(d.convergenceDelta).toEqual(computeDelta(d.pi, nextPi));
    }

    it("finds an all-accumulating stationary distribution", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([
        [1, 0, 0],
        [0.25, 0, 0.75],
        [0.25, 0.75, 0],
      ]);
      const result = await findStationaryDistribution(chain, {
        maxIterations: 255,
        convergenceThreshold: 1e-7,
        verbose: false,
        yieldAfterMs: 1,
      });
      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, result);

      expectStationary(chain, result.pi);
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
      const result = await findStationaryDistribution(chain, {
        maxIterations: 255,
        convergenceThreshold: 1e-7,
        verbose: false,
        yieldAfterMs: 1,
      });

      expect(result.convergenceDelta).toBeLessThanOrEqual(1e-7);
      validateConvegenceDelta(chain, result);

      expectStationary(chain, result.pi);
      const expected = new Float64Array([1 / 3, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
      expectAllClose(result.pi, expected);
    });

    it("finds the stationary distribution of a periodic chain", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([[0, 1], [1, 0]]);
      const result = await findStationaryDistribution(chain, {
        maxIterations: 255,
        convergenceThreshold: 1e-7,
        verbose: false,
        yieldAfterMs: 1,
      });

      expect(result.convergenceDelta).toEqual(0);
      validateConvegenceDelta(chain, result);

      expectStationary(chain, result.pi);
      const expected = new Float64Array([0.5, 0.5]);
      expectAllClose(result.pi, expected);
    });

    it("returns initial distribution if maxIterations===0", async () => {
      const chain = sparseMarkovChainFromTransitionMatrix([[0, 1], [0, 1]]);
      const result = await findStationaryDistribution(chain, {
        verbose: false,
        convergenceThreshold: 1e-7,
        maxIterations: 0,
        yieldAfterMs: 1,
      });
      const expected = new Float64Array([0.5, 0.5]);
      expect(result.pi).toEqual(expected);
      validateConvegenceDelta(chain, result);
    });
  });
});
