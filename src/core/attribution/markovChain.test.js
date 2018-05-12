// @flow

import {
  sparseMarkovChainAction,
  sparseMarkovChainFromTransitionMatrix,
  uniformDistribution,
} from "./markovChain";

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
      expect(() => uniformDistribution((bad: any))).toThrow("positive integer");
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
