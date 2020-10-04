// @flow

// The outcome of a single attempt of a retryable operation.
export type AttemptOutcome<+T, +E> =
  // The operation has terminated successfully.
  | {|+type: "DONE", +value: T|}
  // The operation has terminated with a fatal error.
  | {|+type: "FATAL", +err: E|}
  // The operation has encountered a transient error and should retry
  // after a delay, if retries are still available.
  | {|+type: "RETRY", +err: E|}
  // The operation has exceeded its rate-limit budget and should wait
  // until the given timestamp for that budget to be refreshed, then
  // retry.
  | {|+type: "WAIT", +until: Date, +err: E|};

// The final result of executing an operation after retrying zero or more
// times.
export type Result<+T, +E> =
  // The operation terminated successfully.
  | {|+type: "DONE", +value: T|}
  // The operation encountered a fatal error, or tried to retry or wait
  // more times than permitted by the policy.
  | {|+type: "FAILED", +err: E|};

export type RetryPolicy = {|
  // How long to wait before the first retry, in milliseconds. Defaults
  // to 1000 (i.e., 1 second).
  +initialDelayMs: number,
  // The factor by which to increase the retry delay after each attempt.
  // Defaults to 2.0.
  +backoffRatio: number,
  // The extreme factor by which delays may be subject to jitter. The
  // actual jitter factor is chosen from the uniform distribution from
  // `1.0` to `jitterRatio`. For example, if `jitterRatio` is `1.2` and
  // the nominal delay for an attempt is `4.0` seconds, then the actual
  // delay is chosen uniformly between `4.0` and `4.8` seconds. Jitter
  // is not cumulative; the actual jitter factor is independent for each
  // attempt. Defaults to `1.2`.
  +jitterRatio: number,
  // The number of times that a `RETRY` outcome will be honored before
  // giving up. Note that if an operation always retries, it will
  // execute `maxRetries + 1` times in total. Defaults to 3.
  +maxRetries: number,
  // The number of times that a `WAIT` outcome will be honored before
  // giving up. Defaults to 1.
  +maxWaits: number,
|};

function defaultPolicy(): RetryPolicy {
  return {
    initialDelayMs: 1000,
    backoffRatio: 2.0,
    jitterRatio: 1.2,
    maxRetries: 3,
    maxWaits: 1,
  };
}

export interface Io {
  // Return a new `Date` object representing the current instant.
  now(): Date;
  // Return a promise that resolves after the given number of milliseconds.
  sleepMs(ms: number): Promise<void>;
  // Rolls an actual jitter factor given a maximum jitter ratio.
  rollJitter(r: number): number;
}

/**
 * Run a retryable operation until it terminates or exhausts its retry
 * policy. If `attempt` ever rejects, this function also immediately
 * rejects with the same value.
 */
export default async function retry<T, E>(
  attempt: () => Promise<AttemptOutcome<T, E>>,
  policy?: $Shape<RetryPolicy>,
  // istanbul ignore next: impure non-test implementation
  io?: Io = realIo
): Promise<Result<T, E>> {
  const fullPolicy: RetryPolicy = {...defaultPolicy(), ...policy};
  let nextRetryDelayMs = fullPolicy.initialDelayMs;
  let retries = 0;
  let waits = 0;
  while (true) {
    const outcome = await attempt();
    switch (outcome.type) {
      case "DONE":
        return {type: "DONE", value: outcome.value};
      case "FATAL":
        return {type: "FAILED", err: outcome.err};
      case "RETRY": {
        if (retries >= fullPolicy.maxRetries) {
          return {type: "FAILED", err: outcome.err};
        }
        retries++;
        const delayMs =
          nextRetryDelayMs * io.rollJitter(fullPolicy.jitterRatio);
        await io.sleepMs(delayMs);
        nextRetryDelayMs *= fullPolicy.backoffRatio;
        break;
      }
      case "WAIT": {
        if (waits >= fullPolicy.maxWaits) {
          return {type: "FAILED", err: outcome.err};
        }
        waits++;
        const now = io.now();
        const delayMs = outcome.until - now;
        if (delayMs < 0) {
          const fmt = (d: Date): string => `@${(+d / 1000).toFixed(3)}`;
          throw new Error(
            `wait-until time in the past: ${fmt(outcome.until)} < ${fmt(now)}`
          );
        }
        await io.sleepMs(delayMs);
        break;
      }
      // istanbul ignore next: unreachable per flow
      default:
        throw new Error((outcome.type: empty));
    }
  }
  // istanbul ignore next: unreachable
  // ESLint knows that this next line is unreachable, but Flow doesn't. :-)
  // eslint-disable-next-line no-unreachable
  throw new Error("unreachable");
}

const realIo = {
  // istanbul ignore next: impure non-test implementation
  now(): Date {
    return new Date();
  },
  // istanbul ignore next: impure non-test implementation
  sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  // istanbul ignore next: impure non-test implementation
  rollJitter(r: number): number {
    return 1 + Math.random() * (r - 1);
  },
};
