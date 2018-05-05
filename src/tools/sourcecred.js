//@flow

/*
 * CLI for loading SourceCred graphs. Main entry point for SourceCred users.
 *
 * For usage, run node bin/sourcecred.js --help
 */

import yargs from "yargs/yargs";
import os from "os";
import path from "path";

function pluginGraph(
  repoOwner: string,
  repoName: string,
  plugin: string,
  githubToken?: string
) {
  console.log(
    `
    pluginGraph
    repoOwner: ${repoOwner}
    repoName: ${repoName}
    plugin: ${plugin}
    githubToken?: ${githubToken || "null"}
    `
  );
}

function graph(
  repoOwner: string,
  repoName: string,
  outputDir: string,
  githubToken: string
) {
  console.log(
    `graph
    repoOwner: ${repoOwner}
    repoName: ${repoName}
    outputDir: ${outputDir}
    githubToken: ${githubToken}`
  );
}

function combine(files: string[]) {
  console.log(`combine files: ${files.join(",")}`);
}

function main() {
  function defaultBuilder(yargs) {
    return yargs.strict();
  }

  function repoPositional(yargs) {
    return yargs
      .positional("repoOwner", {
        describe: "the owner of the repository",
      })
      .positional("repoName", {describe: "the name of the repository"});
  }

  function githubToken(yargs, options) {
    const required = options != null && options.required;
    yargs = yargs.option("github-token", {
      demandOption: required,
      describe:
        "a GitHub API token, as generated at https://github.com/settings/tokens/new",
    });
    return yargs;
  }

  function outputDir(yargs) {
    yargs.option("output-dir", {
      describe: "directory to place SourceCred graphs into",
      default: path.join(os.tmpdir(), "sourcecred"),
    });
    return yargs;
  }

  const parser = yargs()
    .command(
      "graph <repoOwner> <repoName>",
      "fetch, combine, and save SourceCred contribution graphs across all standard plugins",
      (yargs) => {
        yargs = defaultBuilder(yargs);
        yargs = repoPositional(yargs);
        yargs = githubToken(yargs, {required: true});
        outputDir(yargs);
      },
      (argv) => {
        let {repoOwner, repoName, githubToken, outputDir} = argv;
        graph(repoOwner, repoName, outputDir, githubToken);
      }
    )
    .command(
      "plugin-graph <repoOwner> <repoName>",
      "print the contribution graph for a particular plugin",
      (yargs) => {
        yargs = defaultBuilder(yargs);
        yargs = repoPositional(yargs);
        yargs = yargs.option("plugin", {
          type: "string",
          choices: ["git", "github"],
          describe: "which plugin to load a graph for",
          demandOption: true,
        });
        githubToken(yargs);
      },
      (argv) => {
        let {repoOwner, repoName, githubToken, plugin} = argv;
        if (typeof plugin !== "string") {
          throw new Error("plugin-graph requires a single string plugin name");
        }
        pluginGraph(repoOwner, repoName, plugin, githubToken);
      }
    )
    .command(
      "combine",
      "combine multiple SourceCred graphs and print the resulting graph",
      (yargs) =>
        defaultBuilder(yargs).option("outputFile", {
          type: "string",
          describe: "File to write output to; prints to stdout if unset",
        }),
      (argv) => {
        let files = argv._.slice(1);
        combine(files);
      }
    )
    .strict();
  parser.parse(process.argv.slice(2));
}

main();
