// @flow
// Implementation of `sourcecred gen-project`.
// This method is intended as a placeholder for generating a project definition,
// before we build a more intentional declarative json config approach, as discussed
// here: https://github.com/sourcecred/sourcecred/issues/1232#issuecomment-519538494
// This method is untested; please take care when modifying it!

import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";
import stringify from "json-stable-stringify";
import {
  type Project,
  projectToJSON,
  createProject as defaultProject,
} from "../core/project";
import {type RepoId} from "../core/repoId";
import {specToProject} from "../plugins/github/specToProject";
import * as NullUtil from "../util/null";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred gen-project PROJECT_ID
                                  [--github GITHUB_SPEC [...]]
                                  [--discourse-url DISCOURSE_URL]
           sourcecred gen-project --help

    Generates a SourceCred project configuration based on the provided specs.

    A PROJECT_ID must be provided, and will be the name of the project.

    Zero or more github specs may be provided; each GitHub spec can be of the
    form OWNER/NAME (as in 'torvalds/linux') for loading a single repository,
    or @owner (as in '@torvalds') for loading all repositories owned by a given
    account.

    A discourse url and discourse username may be provided. If one is provided,
    then both must be. The discourse url is a url to a valid Discourse server,
    as in 'https://discourse.sourcecred.io', and the username must be a valid
    user on that server, as in 'credbot'. The user in question should not have
    any special or admin permissions, so that it won't encounter hidden
    messages.

    All of the GitHub specs, and the Discourse specification (if it exists)
    will be combined into a single project. The serialized project
    configuration will be printed to stdout.

    Arguments:
        PROJECT_ID
            Locally unique identifier for the project.

        --github GITHUB_SPEC
            A specification (in form 'OWNER/NAME' or '@OWNER') of GitHub
            repositories to load.

        --discourse-url DISCOURSE_URL
            The url of a Discourse server to load.

        --help
            Show this help message and exit, as 'sourcecred help scores'.

    Environment Variables:
        SOURCECRED_GITHUB_TOKEN
            API token for GitHub. This should be a 40-character hex
            string. Required if using GitHub specs.

            To generate a token, create a "Personal access token" at
            <https://github.com/settings/tokens>. When loading data for
            public repositories, no special permissions are required.
            For private repositories, the 'repo' scope is required.
    `.trimRight()
  );
}

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help gen-project' for help");
  return 1;
}

export const genProject: Command = async (args, std) => {
  let projectId: string | null = null;
  let discourseUrl: string | null = null;
  const githubSpecs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      case "--github": {
        if (++i >= args.length)
          return die(std, "'--github' given without value");
        githubSpecs.push(args[i]);
        break;
      }
      case "--discourse-url": {
        if (discourseUrl != undefined)
          return die(std, "'--discourse-url' given multiple times");
        if (++i >= args.length)
          return die(std, "'--discourse-url' given without value");
        discourseUrl = args[i];
        break;
      }
      default: {
        if (projectId != null) return die(std, "multiple project IDs provided");
        projectId = args[i];
        break;
      }
    }
  }

  if (projectId == null) {
    return die(std, "no project ID provided");
  }

  const githubToken = Common.githubToken();
  const project: Project = await createProject({
    projectId,
    githubSpecs,
    discourseUrl,
    githubToken,
  });
  const projectJSON = projectToJSON(project);
  console.log(stringify(projectJSON));
  return 0;
};

export async function createProject(opts: {|
  +projectId: string,
  +githubSpecs: $ReadOnlyArray<string>,
  +discourseUrl: string | null,
  +githubToken: string | null,
|}): Promise<Project> {
  const {projectId, githubSpecs, discourseUrl, githubToken} = opts;
  let repoIds: RepoId[] = [];
  let discourseServer = null;
  if (discourseUrl) {
    discourseServer = {serverUrl: discourseUrl};
  }
  if (githubSpecs.length && githubToken == null) {
    throw new Error("Provided GitHub specs without GitHub token.");
  }
  for (const spec of githubSpecs) {
    const subproject = await specToProject(spec, NullUtil.get(githubToken));
    repoIds = repoIds.concat(subproject.repoIds);
  }
  return defaultProject({id: projectId, repoIds, discourseServer});
}

export default genProject;

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};
