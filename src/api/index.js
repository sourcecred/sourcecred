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
import * as graphToMarkovChain from "../core/attribution/graphToMarkovChain";
import * as markovChain from "../core/attribution/markovChain";
import * as timelineCred from "../analysis/timeline/timelineCred";

export default deepFreeze({
  analysis: {
    timeline: {
      timelineCred,
    },
  },
  core: {
    address,
    attribution: {
      markovChain,
      graphToMarkovChain,
    },
    graph,
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
