// @flow
// Implementation of `sourcecred init`

import stringify from "json-stable-stringify";
import dedent from "../util/dedent";
import {type Project, projectToJSON, createProject} from "../core/project";
import type {Command} from "./command";
import * as Common from "./common";
import fs from "fs-extra";
import process from "process";
import path from "path";
import {type DiscourseServer} from "../plugins/discourse/loadDiscourse";
import {type RepoId} from "../plugins/github/repoId";
import {specToProject} from "../plugins/github/specToProject";
import * as NullUtil from "../util/null";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred init [--github GITHUB_SPEC [...]]
                           [--discourse DISCOURSE_URL]
                           [--force]
                           [--print]
           sourcecred init --help

    Sets up a new SourceCred instance, by creating a SourceCred project
    configuration, and saving it to 'sourcecred.json' within the current
    directory.

    Zero or more GitHub specs may be provided; each GitHub spec can be of the
    form OWNER/NAME (as in 'torvalds/linux') for loading a single repository,
    or @owner (as in '@torvalds') for loading all repositories owned by a given
    account. If any GitHub specs are present, then the SOURCECRED_GITHUB_TOKEN
    environment variable is required.

    A discourse url may be provided. The discourse url must be the full url of
    a valid Discourse server, as in 'https://discourse.sourcecred.io'.

    All of the GitHub specs, and the Discourse specification (if it exists)
    will be combined into a single project, which is written to
    sourcecred.json. The file may be manually modified to activate other
    advanced features, such as identity map resolution.

    Arguments:
        --github GITHUB_SPEC
            A specification (in form 'OWNER/NAME' or '@OWNER') of GitHub
            repositories to load.

        --discourse DISCOURSE_URL
            The url of a Discourse server to load.

        --force
            If provided, sourcecred init will overwrite pre-existing
            sourcecred.json files. Otherwise, the command will refuse to
            overwite pre-existing files and fail.

        --print
            If provided, sourcecred init will print the project to stdout
            rather than writing it to sourcecred.json. Mostly used for testing
            purposes, as a SourceCred instance is only valid if the file is
            saved as sourcecred.json. If this flag is set, it supercedes
            --force.

        --help
            Show this help message and exit, as 'sourcecred help init'.

    Environment variables:
        SOURCECRED_GITHUB_TOKEN
            API token for GitHub. This should be a 40-character hex
            string. Required if you provide GitHub specs.

            To generate a token, create a "Personal access token" at
            <https://github.com/settings/tokens>. When loading data for
            public repositories, no special permissions are required.
            For private repositories, the 'repo' scope is required.
    `.trimRight()
  );
}

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help init' for help");
  return 1;
}

const initCommand: Command = async (args, std) => {
  let withForce = false;
  let printToStdOut = false;
  let discourseUrl: string | null = null;
  let githubSpecs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      case "--github": {
        if (++i >= args.length) return die(std, "--github given without value");
        githubSpecs.push(args[i]);
        break;
      }
      case "--discourse": {
        if (discourseUrl != undefined)
          return die(std, "--discourse given multiple times");
        if (++i >= args.length)
          return die(std, "--discourse given without value");
        discourseUrl = args[i];
        break;
      }
      case "--force": {
        withForce = true;
        break;
      }
      case "--print": {
        printToStdOut = true;
        break;
      }
      default: {
        return die(std, `Unexpected argument ${args[i]}`);
      }
    }
  }
  const dir = process.cwd();
  const projectFilePath = path.join(dir, "sourcecred.json");
  const fileAlreadyExists = await fs.exists(projectFilePath);
  if (fileAlreadyExists && !(withForce || printToStdOut)) {
    return die(std, `refusing to overwrite sourcecred.json without --force`);
  }

  const githubToken = Common.githubToken();

  if (githubToken == null && githubSpecs.length) {
    die(std, `provided GitHub specs, but no GitHub token present. try --help`);
  }
  const specsWithToken =
    githubToken == null ? null : {specs: githubSpecs, token: githubToken};
  const project = await genProject(discourseUrl, specsWithToken);
  const projectJson = projectToJSON(project);
  const stringified = stringify(projectJson, {space: 4});
  if (printToStdOut) {
    std.out(stringified);
  } else {
    await fs.writeFile(projectFilePath, stringified + "\n");
  }

  return 0;
};

export type GitHubSpecsWithToken = {|
  +specs: $ReadOnlyArray<string>,
  +token: string,
|};
export async function genProject(
  discourseUrl: string | null,
  githubSpecsWithToken: GitHubSpecsWithToken | null
): Promise<Project> {
  const project: Project = createProject({
    // the id field is obsolete in the instance system, and will be
    // removed once we fully migrate to sourcecred instances.
    id: "obsolete-id",
    repoIds: await genRepoIds(githubSpecsWithToken),
    discourseServer: genDiscourseServer(discourseUrl),
  });
  return project;
}

export function genDiscourseServer(
  discourseUrl: string | null
): DiscourseServer | null {
  if (discourseUrl == null) {
    return null;
  }
  if (!discourseUrl.match(new RegExp("^https?://"))) {
    throw new Error(`discourse url must start with http:// or https://`);
  }
  if (discourseUrl.endsWith("/")) {
    discourseUrl = discourseUrl.slice(0, discourseUrl.length - 1);
  }
  return {serverUrl: discourseUrl};
}

export async function genRepoIds(
  specsWithToken: GitHubSpecsWithToken | null
): Promise<$ReadOnlyArray<RepoId>> {
  let repoIds: RepoId[] = [];
  if (specsWithToken == null) {
    return repoIds;
  }
  const {token, specs} = specsWithToken;
  for (const spec of specs) {
    const subproject = await specToProject(spec, token);
    repoIds = [...repoIds, ...subproject.repoIds];
  }
  return repoIds;
}

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default initCommand;
