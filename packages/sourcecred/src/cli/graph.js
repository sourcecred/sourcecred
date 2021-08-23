// @flow

import stringify from "json-stable-stringify";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import dedent from "../util/dedent";
import {
  compareGraphs,
  nodeToString,
  edgeToString,
  NodeAddress,
  EdgeAddress,
} from "../core/graph";
import {compareWeights} from "../core/weights";
import {type WeightedGraph} from "../core/weightedGraph";
import * as pluginId from "../api/pluginId";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {graph} from "../api/main/graph";

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
  const instance: Instance = await new LocalInstance(baseDir);
  const graphInput = await instance.readGraphInput();

  const availablePlugins = graphInput.plugins.map(({pluginId}) => pluginId);
  let pluginsToLoad = [];
  if (processedArgs.length === 0) {
    pluginsToLoad = availablePlugins;
  } else {
    for (const arg of processedArgs) {
      const id = pluginId.fromString(arg);
      if (availablePlugins.includes(id)) {
        pluginsToLoad.push(id);
      } else {
        return die(
          std,
          `can't find plugin ${id}; remember to use fully scoped name, as in sourcecred/github`
        );
      }
    }
  }

  const graphOutput = await graph(graphInput, pluginsToLoad, taskReporter);

  if (shouldIncludeDiff) {
    for (const {pluginId, weightedGraph} of graphOutput.pluginGraphs) {
      const diffTask = `${pluginId}: diffing with existing graph`;
      taskReporter.start(diffTask);
      try {
        const oldWeightedGraph = await instance.readWeightedGraphForPlugin(
          pluginId
        );
        computeAndLogDiff(oldWeightedGraph, weightedGraph, pluginId, std);
      } catch (error) {
        std.out(
          `Could not find or compare existing graph.json for ${pluginId}. ${error}`
        );
      }
      taskReporter.finish(diffTask);
    }
  }

  if (!isSimulation) {
    taskReporter.start("writing files");
    await instance.writeGraphOutput(graphOutput);
    taskReporter.finish("writing files");
  }
  taskReporter.finish("graph");
  return 0;
};

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
  pluginName: string,
  std
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
    std.out(
      `${horizontalRule}\n  ${pluginName} - Node Diffs\n${horizontalRule}`
    );
    for (const nodeDiff of graphDiff.nodeDiffs) {
      std.out(
        `Old:\t${
          nodeDiff.first ? nodeToString(nodeDiff.first) : "No matching address"
        }`
      );
      std.out(
        `New:\t${
          nodeDiff.second
            ? nodeToString(nodeDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (weightDiff.nodeWeightDiffs.length > 0) {
    std.out(
      `${horizontalRule}\n  ${pluginName} - Node Weight Diffs\n${horizontalRule}`
    );
    for (const nodeWeightDiff of weightDiff.nodeWeightDiffs) {
      std.out(`${NodeAddress.toString(nodeWeightDiff.address)}`);
      std.out(
        `Old:\t${
          nodeWeightDiff.first != null
            ? nodeWeightDiff.first.toString()
            : "No matching address"
        }`
      );
      std.out(
        `New:\t${
          nodeWeightDiff.second != null
            ? nodeWeightDiff.second.toString()
            : "No matching address"
        }\n`
      );
    }
  }
  if (graphDiff.edgeDiffs.length > 0) {
    std.out(
      `${horizontalRule}\n  ${pluginName} - Edge Diffs\n${horizontalRule}`
    );
    for (const edgeDiff of graphDiff.edgeDiffs) {
      std.out(
        `Old:\t${
          edgeDiff.first ? edgeToString(edgeDiff.first) : "No matching address"
        }`
      );
      std.out(
        `New:\t${
          edgeDiff.second
            ? edgeToString(edgeDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (weightDiff.edgeWeightDiffs.length > 0) {
    std.out(
      `${horizontalRule}\n  ${pluginName} - Edge Weight Diffs\n${horizontalRule}`
    );
    for (const edgeWeightDiff of weightDiff.edgeWeightDiffs) {
      std.out(`${EdgeAddress.toString(edgeWeightDiff.address)}`);
      std.out(
        `Old:\t${
          edgeWeightDiff.first
            ? stringify(edgeWeightDiff.first)
            : "No matching address"
        }`
      );
      std.out(
        `New:\t${
          edgeWeightDiff.second
            ? stringify(edgeWeightDiff.second)
            : "No matching address"
        }\n`
      );
    }
  }
  if (graphDiff.graphsAreEqual && weightDiff.weightsAreEqual)
    std.out(
      `${horizontalRule}\n  ${pluginName} - Unchanged\n${horizontalRule}`
    );
  else
    std.out(`${horizontalRule}\n  ${pluginName} - Summary of Changes\n${horizontalRule}
Node Diffs: ${graphDiff.nodeDiffs.length}
Node Weight Diffs: ${weightDiff.nodeWeightDiffs.length}
Edge Diffs: ${graphDiff.edgeDiffs.length}
Edge Weight Diffs: ${weightDiff.edgeWeightDiffs.length}`);
}

export default graphCommand;
