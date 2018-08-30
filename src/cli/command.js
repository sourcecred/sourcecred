// @flow

export type ExitCode = number;

export interface Stdio {
  /**
   * Print a line to stdout. A newline will be added.
   */
  out(line: string): void;
  /**
   * Print a line to stderr. A newline will be added.
   */
  err(line: string): void;
}

export type Command = (
  args: $ReadOnlyArray<string>,
  std: Stdio
) => Promise<ExitCode>;

export function handlingErrors(command: Command): Command {
  return async (args, stdio) => {
    function die(e) {
      stdio.err(e instanceof Error ? e.stack : JSON.stringify(e));
      return Promise.resolve(1);
    }
    try {
      return command(args, stdio).catch((e) => die(e));
    } catch (e) {
      return die(e);
    }
  };
}
