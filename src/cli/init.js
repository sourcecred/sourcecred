// @flow
// Implementation of `sourcecred init`

import dedent from "../util/dedent";
import {type RepoId, stringToRepoId} from "../core/repoId";
import {type Project, projectToJSON} from "../core/project";
import type {Command} from "./command";
import * as Common from "./common";
import fs from "fs-extra";
import process from "process";
import read from "read";
import path from "path";
import {fetchGithubOrg} from "../plugins/github/fetchGithubOrg";
import {type DiscourseServer} from "../plugins/discourse/loadDiscourse";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred init
           sourcecred init --help

    Sets up a new SourceCred instance, by interactively creating a SourceCred
    project configuration, and saving it to 'sourcecred.json'.

    Arguments:
        --help
            Show this help message and exit, as 'sourcecred help init'.

    Environment variables:
        SOURCECRED_GITHUB_TOKEN
            API token for GitHub. This should be a 40-character hex
            string. Required if you want to load whole GitHub orgs.

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
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      default: {
        return die(std, `Unexpected argument ${args[i]}`);
      }
    }
  }
  const dir = process.cwd();
  const projectFilePath = path.join(dir, "sourcecred.json");
  if (await fs.exists(projectFilePath)) {
    return die(std, `Refusing to overwrite sourcecred.json file in ${dir}`);
  }
  const basename = path.basename(dir);
  const name = await aread({
    prompt: "Choose an instance name:",
    default: basename,
  });
  std.out("");

  let repoIds: RepoId[] = [];
  const githubToken = Common.githubToken();
  if (githubToken == null) {
    std.out("Skipping organization loading, as no GitHub token available.");
  } else {
    std.out("Now you can add any GitHub organizations you want to load.");
    std.out("You'll have the option to load multiple orgs, one at a time.");
    std.out("Leave a blank response when done adding orgs.");
    std.out("You'll have the option to add individual repos next.");
    while (true) {
      const nextOrg = await aread({prompt: "The name of an org to add:"});
      if (nextOrg === "") {
        break;
      } else {
        const {repos} = await fetchGithubOrg(nextOrg, githubToken);
        repoIds = [...repoIds, ...repos];
      }
    }
  }
  std.out("");

  std.out("Now you can add individual GitHub repositories.");
  std.out("Add them in format OWNER/NAME, like in torvalds/linux.");
  std.out("Leave a blank response when done adding repos.");
  while (true) {
    const nextRepo = await aread({prompt: "The name of a repo to add:"});
    if (nextRepo === "") {
      break;
    }
    const repoId = stringToRepoId(nextRepo);
    repoIds.push(repoId);
  }
  std.out("");

  let discourseServer: DiscourseServer | null = null;
  std.out("Now you can add a Discourse server url.");
  std.out("It should begin with http:// or https://");
  std.out("Leave blank if you don't want to add a Discourse server.");
  let serverUrl = await aread({prompt: "Discourse server url, or blank"});
  if (serverUrl !== "") {
    if (!serverUrl.startsWith("https://") && !serverUrl.startsWith("http://")) {
      return die(std, "serverUrl should start with http:// or https://");
    }
    if (serverUrl.endsWith("/")) {
      serverUrl = serverUrl.slice(0, serverUrl.length - 1);
    }
    discourseServer = {serverUrl};
  }

  const project: Project = {
    id: name,
    repoIds,
    discourseServer,
    identities: [],
  };

  const projectJson = projectToJSON(project);
  await fs.writeFile(projectFilePath, JSON.stringify(projectJson, null, 2));

  std.out("Done. Inspect `sourcecred.json` for results.");

  return 0;
};

// Async version of `read`
function aread(options): Promise<string> {
  return new Promise((resolve, reject) => {
    read(options, (error, result) => {
      if (error) {
        reject(error);
      }
      resolve(result);
    });
  });
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
