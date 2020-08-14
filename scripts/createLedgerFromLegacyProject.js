// @flow
import fs from "fs-extra";
import path from "path";

import * as C from "../src/util/combo";
import {Ledger} from "../src/ledger/ledger";
import type {NodeAddressT} from "../src/core/graph";
import {resolveAlias} from "../src/cli/alias";
import {nameFromString} from "../src/ledger/identity";

const URL_PATTERN = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

type LegacyProject = [
  {|
    type: "sourcecred/project",
    version: string,
  |},
  {
    discourseServer: {|
      serverUrl: string,
    |},
    identities: Array<{|+username: string, +aliases: Array<string>|}>,
  }
];

const projectParser: C.Parser<LegacyProject> = C.tuple([
  C.object({
    type: C.exactly(["sourcecred/project"]),
    version: C.string,
  }),
  C.object({
    discourseServer: C.object({
      serverUrl: C.fmap(C.string, validateUrl),
    }),
    identities: C.array(
      C.object({
        username: C.string,
        aliases: C.array(C.string),
      })
    ),
  }),
]);

function validateUrl(url: string): string {
  if (!url.match(URL_PATTERN)) {
    throw new Error(`invalid URL: ${url}`);
  }
  return url;
}

function parseProject(raw: C.JsonObject): LegacyProject {
  return projectParser.parseOrThrow(raw);
}

async function loadProject(instanceDirectory: string): Promise<LegacyProject> {
  const jsonPath = path.join(instanceDirectory, "project.json");
  try {
    const contents = await fs.readFile(jsonPath);
    return parseProject(JSON.parse(contents));
  } catch (e) {
    if (e.message.startsWith("ENOENT:")) {
      throw `project from directory "${instanceDirectory}" not loaded`;
    }
    throw e;
  }
}

export async function loadLedger(legacyDir: string): Promise<Ledger> {
  const [_, {identities, discourseServer}] = await loadProject(legacyDir);

  const aliasParser: C.Parser<NodeAddressT[]> = C.array(
    C.fmap(C.string, (a) => resolveAlias(a, discourseServer.serverUrl))
  );

  const ledger = new Ledger();

  identities.forEach(({username, aliases}) => {
    username = username.replace("_", "-");
    const userId = ledger.createIdentity("USER", username);
    const fullAliases = aliases.map((a) => ({
      address: resolveAlias(a, discourseServer.serverUrl),
      description: a,
    }));
    fullAliases.forEach((a) => ledger.addAlias(userId, a));
  });

  return ledger;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new Error(
      "Please provide the path to the legacy SourceCred instance"
    );
  }

  const ledger = await loadLedger(args[0]);
  console.log(ledger.serialize());
}

main();
