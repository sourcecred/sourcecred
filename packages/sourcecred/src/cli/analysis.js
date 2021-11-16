// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {analysis} from "../api/main/analysis";
import {join as pathJoin} from "path";

const analysisCommand: Command = async (args, std) => {
  const baseDir = process.cwd();
  let neo4j = false;
  args.forEach((arg) => {
    switch (arg) {
      case "--neo4j":
      case "-n":
        neo4j = true;
        return;
    }
  });

  const instance: Instance = new LocalInstance(baseDir);
  const analysisInput = {
    ...(await instance.readAnalysisInput()),
    featureFlags: {
      neo4j,
    },
  };

  const output = await analysis(analysisInput);
  await instance.writeAnalysisOutput(output);

  if (neo4j && output.neo4j) printNeo4jCommandHelp(output.neo4j, std);

  return 0;
};

export const analysisHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred analysis [options]

      options:
      -n, --neo4j     Generates CSV files that can be used to import the CredGraph into Neo4j

      Generates data structures useful for data analysis and writes them to
      disk.
      `.trimRight()
  );
  return 0;
};

function printNeo4jCommandHelp(neo4jOutput, std) {
  std.out(dedent`
    Neo4j CSV files generated. Now you just need to import them into a Neo4j
    database using neo4j-admin. Here's some help with the commands. These are
    our best-effort constructions, please verify their correctness before use.

    # You must manually construct this template command.
    export NEO=/path/to/directory/of/your/neo4j/DBMS

    export NEO_CSV_FOLDER=${pathJoin(process.cwd(), "output", "neo4j")}

    # CAREFUL, this command wipes the Neo4j DB. This prepares it for a fresh import.
    rm -r $NEO/data/databases/neo4j ; rm -r $NEO/data/transactions/neo4j

    $NEO/bin/neo4j-admin import --database=neo4j \\
    ${[...Array(neo4jOutput.nodes.iterationsCompleted()).keys()]
      .map((i) => `--nodes=$NEO_CSV_FOLDER/nodes_${i + 1}.csv`)
      .join(" \\\n")} \\
    ${[...Array(neo4jOutput.edges.iterationsCompleted()).keys()]
      .map((i) => `--relationships=$NEO_CSV_FOLDER/edges_${i + 1}.csv`)
      .join(" \\\n")}
    `);
}

export default analysisCommand;
