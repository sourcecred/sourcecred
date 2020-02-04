//@flow

import {type Project} from "../core/project";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {type Loader as GithubLoader} from "../plugins/github/loader";
import {type Loader as IdentityLoader} from "../plugins/identity/loader";
import {type Loader as DiscourseLoader} from "../plugins/discourse/loader";

/**
 * A type combining all known plugin Loader interfaces.
 *
 * Using this allows us to define "for all plugins" semantics, while keeping
 * each underlying plugin's interface flexible.
 */
export type PluginLoaders = {|
  +github: GithubLoader,
  +discourse: DiscourseLoader,
  +identity: IdentityLoader,
|};

/**
 * Gets all relevant PluginDeclarations for a given Project.
 */
export function declarations(
  {github, discourse, identity}: PluginLoaders,
  project: Project
): $ReadOnlyArray<PluginDeclaration> {
  const plugins: PluginDeclaration[] = [];
  if (project.repoIds.length) {
    plugins.push(github.declaration());
  }
  if (project.discourseServer != null) {
    plugins.push(discourse.declaration());
  }
  if (project.identities.length) {
    plugins.push(identity.declaration());
  }
  return plugins;
}
