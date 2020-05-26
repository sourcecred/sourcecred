// @flow

import type {CliPlugin} from "./cliPlugin";

/**
 * Returns an object mapping owner-name pairs to CLI plugin
 * declarations; keys are like `sourcecred/github`.
 */
export function bundledPlugins(): {[pluginId: string]: CliPlugin} {
  // TODO(@wchargin,@decentralion): Implement adapters.
  return {};
}
