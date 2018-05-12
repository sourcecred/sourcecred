// @flow

import {sparseMarkovChainFromTransitionMatrix} from "./markovChain";

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
