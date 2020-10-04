// @flow

import retry, {type AttemptOutcome, type Io, type Result} from "./retry";

/**
 * Simple world with a self-contained clock, treated consistently across
 * calls to `now` and `sleepMs`, and a customizable, deterministic
 * jitter function. The jitter function is defined by an infinite
 * sequence of uniform variates (i.e., reals in `[0.0, 1.0]`) that
 * determine how much jitter to apply (`0.0` = none, `1.0` = full).
 * A finite prefix of the uniform variate sequence is given to the
 * constructor; all subsequent elements are `0.0`.
 */
class World implements Io {
  +_startMs: number;
  _nowMs: number;
  _uniformVariates: number[];

  constructor(uniformVariates: number[] = []) {
    // Use a realistic anchor time (2001-02-03 01:04:05.678 UTC).
    this._startMs = 981162245678;
    this._nowMs = this._startMs;
    this._uniformVariates = uniformVariates;
  }

  now() {
    return new Date(this._nowMs);
  }

  elapsed() {
    return this._nowMs - this._startMs;
  }

  sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this._nowMs += ms;
        resolve();
      }, 0);
    });
  }

  rollJitter(r: number): number {
    const u = this._uniformVariates.shift() || 0;
    return 1 + u * (r - 1);
  }
}

describe("util/retry", () => {
  it("passes through immediate termination", async () => {
    const w = new World();
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      return {type: "DONE", value: 777};
    };
    const result = await retry(attempt, {}, w);
    expect(result).toEqual({type: "DONE", value: 777});
    expect(calledAt).toEqual([0]);
  });

  it("passes through rejection", async () => {
    const attempt = async () => {
      throw "I have failed you";
    };
    await expect(() => retry(attempt, {}, new World())).rejects.toEqual(
      "I have failed you"
    );
  });

  it("retries within the policy limit", async () => {
    const w = new World();
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      if (calledAt.length >= 4) {
        return {type: "DONE", value: null};
      } else {
        return {type: "RETRY", err: "again"};
      }
    };
    const result = await retry(attempt, {maxRetries: 5, jitterRatio: 1.0}, w);
    expect(result).toEqual({type: "DONE", value: null});
    expect(calledAt).toEqual([0, 1000, 3000, 7000]);
  });

  it("respects the max-retries limit, taking the latest error", async () => {
    const w = new World();
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      expect(calledAt.length).toBeLessThan(100); // prevent runaway
      return {type: "RETRY", err: `n=${calledAt.length}`};
    };
    const result = await retry(attempt, {maxRetries: 5, jitterRatio: 1.0}, w);
    expect(result).toEqual({type: "FAILED", err: "n=6"});
    expect(calledAt).toHaveLength(1 + 5);
    expect(calledAt).toEqual([0, 1000, 3000, 7000, 15000, 31000]);
  });

  it("respects a max-retries limit of 0", async () => {
    const w = new World();
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      expect(calledAt.length).toBeLessThan(100); // prevent runaway
      return {type: "RETRY", err: "never"};
    };
    const result = await retry(attempt, {maxRetries: 0}, w);
    expect(result).toEqual({type: "FAILED", err: "never"});
    expect(calledAt).toEqual([0]);
  });

  it("includes jitter for retry delays", async () => {
    const w = new World([1.0, 0.0, 0.25]);
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      if (calledAt.length >= 4) {
        return {type: "DONE", value: null};
      } else {
        return {type: "RETRY", err: "again"};
      }
    };
    const result = await retry(attempt, {maxRetries: 5, jitterRatio: 1.5}, w);
    expect(result).toEqual({type: "DONE", value: null});
    const expectedDeltas = [1000 * 1.5, 2000 * 1.0, 4000 * 1.125];
    expect(calledAt).toEqual(prefixSums(expectedDeltas));
  });

  it("waits until a specified instant", async () => {
    const w = new World();
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      switch (calledAt.length) {
        case 1:
          return {type: "WAIT", until: new Date(+w.now() + 2500), err: "one"};
        case 2:
          return {type: "WAIT", until: new Date(+w.now() + 1000), err: "two"};
        case 3:
          return {type: "DONE", value: null};
        default:
          throw new Error(`unreachable calledAt.length: ${calledAt.length}`);
      }
    };
    const result = await retry(attempt, {maxWaits: 3}, w);
    expect(result).toEqual({type: "DONE", value: null});
    expect(calledAt).toEqual([0, 2500, 3500]);
  });

  it("ignores jitter for wait-until outcomes", async () => {
    const w = new World([1.0, 1.0, 1.0]);
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      switch (calledAt.length) {
        case 1:
          return {type: "WAIT", until: new Date(+w.now() + 2500), err: "one"};
        case 2:
          return {type: "WAIT", until: new Date(+w.now() + 1000), err: "two"};
        case 3:
          return {type: "DONE", value: null};
        default:
          throw new Error(`unreachable calledAt.length: ${calledAt.length}`);
      }
    };
    const result = await retry(attempt, {maxWaits: 3, jitterRatio: 1.5}, w);
    expect(result).toEqual({type: "DONE", value: null});
    expect(calledAt).toEqual([0, 2500, 3500]);
  });

  it("respects the max-waits limit, taking the latest error", async () => {
    const w = new World([1.0, 1.0, 1.0]);
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      switch (calledAt.length) {
        case 1:
          return {type: "WAIT", until: new Date(+w.now() + 2500), err: "one"};
        case 2:
          return {type: "WAIT", until: new Date(+w.now() + 1000), err: "two"};
        default:
          throw new Error(`unreachable calledAt.length: ${calledAt.length}`);
      }
    };
    const result = await retry(attempt, {maxWaits: 1}, w);
    expect(result).toEqual({type: "FAILED", err: "two"});
    expect(calledAt).toEqual([0, 2500]);
  });

  it("respects a max-waits limit of 0", async () => {
    const w = new World([1.0, 1.0, 1.0]);
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      switch (calledAt.length) {
        case 1:
          return {type: "WAIT", until: new Date(+w.now() + 2500), err: "wait"};
        default:
          throw new Error(`unreachable calledAt.length: ${calledAt.length}`);
      }
    };
    const result = await retry(attempt, {maxWaits: 0}, w);
    expect(result).toEqual({type: "FAILED", err: "wait"});
    expect(calledAt).toEqual([0]);
  });

  it("interleaves retries and waits", async () => {
    const w = new World([1.0, 0.25, 0.75]);
    const calledAt = [];
    const attempt = async () => {
      calledAt.push(w.elapsed());
      switch (calledAt.length) {
        case 1:
          return {type: "RETRY", err: 1};
        case 2:
          return {type: "WAIT", until: new Date(+w.now() + 1234), err: 2};
        case 3:
          return {type: "RETRY", err: 3};
        case 4:
          return {type: "RETRY", err: 4};
        case 5:
          return {type: "WAIT", until: new Date(+w.now() + 6789), err: 5};
        case 6:
          return {type: "DONE", value: "voila"};
        default:
          throw new Error(`unreachable calledAt.length: ${calledAt.length}`);
      }
    };
    const result = await retry(
      attempt,
      {maxRetries: 10, maxWaits: 10, jitterRatio: 1.5},
      w
    );
    expect(result).toEqual({type: "DONE", value: "voila"});
    const expectedDeltas = [1000 * 1.5, 1234, 2000 * 1.125, 4000 * 1.375, 6789];
    expect(calledAt).toEqual(prefixSums(expectedDeltas));
  });

  it("rejects on a wait time in the past", async () => {
    const w = new World();
    const attempt = async () => {
      return {type: "WAIT", until: new Date(+w.now() - 1234), err: "again"};
    };
    await expect(() => retry(attempt, {}, w)).rejects.toThrow(
      "wait-until time in the past"
    );
  });
});

// `scanl (+) 0`: e.g., [1, 10, 3] -> [0, 1, 11, 14]
function prefixSums(xs: $ReadOnlyArray<number>): number[] {
  const partials = [0];
  for (const x of xs) {
    const last = partials[partials.length - 1];
    partials.push(last + x);
  }
  return partials;
}
