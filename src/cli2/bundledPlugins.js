// @flow

import type {CliPlugin} from "./cliPlugin";
import {GithubCliPlugin} from "../plugins/github/cliPlugin";

/**
 * Returns an object mapping owner-name pairs to CLI plugin
 * declarations; keys are like `sourcecred/github`.
 */
export function bundledPlugins(): {[pluginId: string]: CliPlugin} {
  return {"sourcecred/github": new GithubCliPlugin()};
}
