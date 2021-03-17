// @flow

import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";

import {Ledger} from "../core/ledger/ledger";
import * as NullUtil from "../util/null";
import {LoggingTaskReporter} from "../util/taskReporter";
import {type ReferenceDetector} from "../core/references/referenceDetector";
import {CascadingReferenceDetector} from "../core/references/cascadingReferenceDetector";
import type {Command} from "./command";
import dedent from "../util/dedent";
import {type InstanceConfig} from "../api/instanceConfig";
import {
  makePluginDir,
  loadInstanceConfig,
  pluginDirectoryContext,
  loadLedger,
  saveLedger,
  loadWeightedGraphForPlugin,
} from "./common";
import {
  compareGraphs,
  nodeToString,
  edgeToString,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {compareWeights} from "../core/weights";
import {
  toJSON as weightedGraphToJSON,
  type WeightedGraph,
} from "../core/weightedGraph";
import * as pluginId from "../api/pluginId";
import {DiskStorage} from "../core/storage/disk";
import {WritableZipStorage} from "../core/storage/zip";
import {encode} from "../core/storage/textEncoding";
import {ensureIdentityExists} from "../core/ledger/identityProposal";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const graphCommand: Command = async (args, std) => {
  let shouldIncludeDiff = false;
  let isSimulation = false;
  const processedArgs = args.filter((arg) => {
    switch (arg) {
      case "-d":
        shouldIncludeDiff = true;
        return false;
      case "--simulation":
      case "-s":
        isSimulation = true;
        return false;
      default:
        return true;
    }
  });

  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("graph");
  const baseDir = process.cwd();
  const config: InstanceConfig = await loadInstanceConfig(baseDir);

  const ledger = await loadLedger(baseDir);

  let pluginsToLoad = [];
  if (processedArgs.length === 0) {
    pluginsToLoad = config.bundledPlugins.keys();
  } else {
    for (const arg of processedArgs) {
      const id = pluginId.fromString(arg);
      if (config.bundledPlugins.has(id)) {
        pluginsToLoad.push(id);
      } else {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
    }
  }

  const graphOutputPrefix = ["output", "graphs"];

  const rd = await buildReferenceDetector(
    baseDir,
    config,
    taskReporter,
    ledger
  );
  for (const name of pluginsToLoad) {
    const generateGraphTask = `${name}: generating graph`;
    taskReporter.start(generateGraphTask);
    const plugin = NullUtil.get(config.bundledPlugins.get(name));
    const dirContext = pluginDirectoryContext(baseDir, name);
    const weightedGraph = await plugin.graph(dirContext, rd, taskReporter);

    const identities = await plugin.identities(dirContext, taskReporter);
    for (const identityProposal of identities) {
      ensureIdentityExists(ledger, identityProposal);
    }
    taskReporter.finish(generateGraphTask);

    if (shouldIncludeDiff) {
      const diffTask = `${name}: diffing with existing graph`;
      taskReporter.start(diffTask);
      try {
        const oldWeightedGraph = await loadWeightedGraphForPlugin(
          name,
          baseDir
        );
        computeAndLogDiff(oldWeightedGraph, weightedGraph, name);
      } catch (error) {
        console.log(
          `Could not find or compare existing graph.json for ${name}. ${error}`
        );
      }
      taskReporter.finish(diffTask);
    }

    if (!isSimulation) {
      const writeTask = `${name}: writing graph`;
      taskReporter.start(writeTask);
      const serializedGraph = encode(
        stringify(weightedGraphToJSON(weightedGraph))
      );
      const outputDir = makePluginDir(baseDir, graphOutputPrefix, name);
      const graphStorage = new WritableZipStorage(new DiskStorage(outputDir));
      await graphStorage.set("graph.json.gzip", serializedGraph);
      taskReporter.finish(writeTask);
    }
  }
  if (!isSimulation) {
    await saveLedger(baseDir, ledger);
  }
  taskReporter.finish("graph");
  return 0;
};

async function buildReferenceDetector(baseDir, config, taskReporter, ledger) {
  taskReporter.start("reference detector");
  const rds = [];
  for (const [name, plugin] of sortBy(
    [...config.bundledPlugins],
    ([k, _]) => k
  )) {
    const dirContext = pluginDirectoryContext(baseDir, name);
    const task = `reference detector for ${name}`;
    taskReporter.start(task);
    const rd = await plugin.referenceDetector(dirContext, taskReporter);
    rds.push(rd);
    taskReporter.finish(task);
  }
  taskReporter.finish("reference detector");
  rds.push(_hackyIdentityNameReferenceDetector(ledger));
  return new CascadingReferenceDetector(rds);
}

// Hack to support old-school (deprecated) "initiatives files":
// We need to be able to parse references to usernames, e.g. "@yalor", so
// we need a reference detector that will match these to identities in the
// Ledger. This isn't a robust addressing scheme, since identities are re-nameable;
// in v2 the initiatives plugin will be re-written to use identity node addresses instead.
// This hack can be safely deleted once we no longer support initiatives files that refer
// to identities by their names instead of their IDs.
export function _hackyIdentityNameReferenceDetector(
  ledger: Ledger
): ReferenceDetector {
  const usernameToAddress = new Map(
    ledger.accounts().map((a) => [a.identity.name, a.identity.address])
  );
  function addressFromUrl(potentialUsername: string) {
    const prepped = potentialUsername.replace("@", "").toLowerCase();
    return usernameToAddress.get(prepped);
  }
  return {addressFromUrl};
}

export const graphHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred graph [options]

      options:
      -d  Outputs the diff of changes compared to the last saved graph.
      -s, --simulation  Skips writing changes to the graph and ledger jsons.

      Generate a graph from cached plugin data

      Either 'sourcecred load' must immediately precede this command or
      a cache directory must exist for all plugins specified in sourcecred.json
      `.trimRight()
  );
  return 0;
};

function computeAndLogDiff(
  oldWeightedGraph: WeightedGraph,
  newWeightedGraph: WeightedGraph,
  pluginName: string
) {
  const graphDiff = compareGraphs(
    oldWeightedGraph.graph,
    newWeightedGraph.graph
  );
  const weightDiff = compareWeights(
    oldWeightedGraph.weights,
    newWeightedGraph.weights
  );
  const horizontalRule =
    "=============================================================";
  if (graphDiff.nodeDiffs.length > 0) {
    console.log(
      `${horizontalRule}\n  ${pluginName} - Node Diffs\n${horizontalRule}`
    );
    for (const nodeDiff of graphDiff.nodeDiffs) {
      console.log(
        `Old:\t${
          nodeDiff.first ? nodeToString(nodeDiff.first) : "No matching address"
        }`
      );
      console.log(
        `New:\t${
          nodeDiff.second
            ? nodeToString(nodeDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (weightDiff.nodeWeightDiffs.length > 0) {
    console.log(
      `${horizontalRule}\n  ${pluginName} - Node Weight Diffs\n${horizontalRule}`
    );
    for (const nodeWeightDiff of weightDiff.nodeWeightDiffs) {
      console.log(`${NodeAddress.toString(nodeWeightDiff.address)}`);
      console.log(
        `Old:\t${
          nodeWeightDiff.first != null
            ? nodeWeightDiff.first.toString()
            : "No matching address"
        }`
      );
      console.log(
        `New:\t${
          nodeWeightDiff.second != null
            ? nodeWeightDiff.second.toString()
            : "No matching address"
        }\n`
      );
    }
  }
  if (graphDiff.edgeDiffs.length > 0) {
    console.log(
      `${horizontalRule}\n  ${pluginName} - Edge Diffs\n${horizontalRule}`
    );
    for (const edgeDiff of graphDiff.edgeDiffs) {
      console.log(
        `Old:\t${
          edgeDiff.first ? edgeToString(edgeDiff.first) : "No matching address"
        }`
      );
      console.log(
        `New:\t${
          edgeDiff.second
            ? edgeToString(edgeDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (weightDiff.edgeWeightDiffs.length > 0) {
    console.log(
      `${horizontalRule}\n  ${pluginName} - Edge Weight Diffs\n${horizontalRule}`
    );
    for (const edgeWeightDiff of weightDiff.edgeWeightDiffs) {
      console.log(`${EdgeAddress.toString(edgeWeightDiff.address)}`);
      console.log(
        `Old:\t${
          edgeWeightDiff.first
            ? stringify(edgeWeightDiff.first)
            : "No matching address"
        }`
      );
      console.log(
        `New:\t${
          edgeWeightDiff.second
            ? stringify(edgeWeightDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (graphDiff.graphsAreEqual && weightDiff.weightsAreEqual)
    console.log(
      `${horizontalRule}\n  ${pluginName} - Unchanged\n${horizontalRule}`
    );
  else
    console.log(`${horizontalRule}\n  ${pluginName} - Summary of Changes\n${horizontalRule}
Node Diffs: ${graphDiff.nodeDiffs.length}
Node Weight Diffs: ${weightDiff.nodeWeightDiffs.length}
Edge Diffs: ${graphDiff.edgeDiffs.length}
Edge Weight Diffs: ${weightDiff.edgeWeightDiffs.length}`);
}

export default graphCommand;
