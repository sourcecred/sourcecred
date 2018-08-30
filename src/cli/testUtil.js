// @flow

import {type Command, type ExitCode, handlingErrors} from "./command";

// Run a command, capturing its stdout, stderr, and exit code. A thrown
// exception will be handled as with `handlingErrors`.
export async function run(
  command: Command,
  args: $ReadOnlyArray<string>
): Promise<{|
  +exitCode: ExitCode,
  +stdout: $ReadOnlyArray<string>,
  +stderr: $ReadOnlyArray<string>,
|}> {
  const stdout = [];
  const stderr = [];
  const exitCode = await handlingErrors(command)(args, {
    out: (x) => void stdout.push(x),
    err: (x) => void stderr.push(x),
  });
  return {exitCode, stdout, stderr};
}
