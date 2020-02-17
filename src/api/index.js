// @flow

import deepFreeze from "deep-freeze";

// Exports for calling SourceCred code programmatically. Both the
// structure and the contents of this API are experimental and subject
// to change.
import * as address from "../core/address";
import * as discourseAddress from "../plugins/discourse/address";
import * as discourseDeclaration from "../plugins/discourse/declaration";
import * as githubDeclaration from "../plugins/github/declaration";
import * as githubEdges from "../plugins/github/edges";
import * as githubNodes from "../plugins/github/nodes";
import * as graph from "../core/graph";
import * as weightedGraph from "../core/weightedGraph";
import * as weights from "../core/weights";
import * as graphToMarkovChain from "../core/algorithm/graphToMarkovChain";
import * as markovChain from "../core/algorithm/markovChain";
import * as timelineCred from "../analysis/timeline/timelineCred";
import * as markovProcessGraph from "../core/markovProcessGraph";
import * as credGraph from "../core/credGraph";
import * as pagerank from "../core/algorithm/pagerank";

export default deepFreeze({
  analysis: {
    timeline: {
      timelineCred,
    },
  },
  core: {
    address,
    algorithm: {
      markovChain,
      graphToMarkovChain,
      pagerank,
    },
    graph,
    weightedGraph,
    weights,
    credGraph,
    markovProcessGraph,
  },
  plugins: {
    github: {
      declaration: githubDeclaration,
      edges: githubEdges,
      nodes: githubNodes,
    },
    discourse: {
      address: discourseAddress,
      declaration: discourseDeclaration,
    },
  },
});
