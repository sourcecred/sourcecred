// @flow

import deepFreeze from "deep-freeze";

// Exports for calling SourceCred code programmatically. Both the
// structure and the contents of this API are experimental and subject
// to change.
import * as discourseAddress from "../plugins/discourse/address";
import * as discourseDeclaration from "../plugins/discourse/declaration";
import * as discordDeclaration from "../plugins/discord/declaration";
import * as discordUtils from "../plugins/discord/utils";

import * as initiativesDeclaration from "../plugins/initiatives/declaration";
import * as githubDeclaration from "../plugins/github/declaration";
import * as githubEdges from "../plugins/github/edges";
import * as githubNodes from "../plugins/github/nodes";
import * as ethereumDeclaration from "../plugins/ethereum/declaration";
import * as ethereumUtils from "../plugins/ethereum/utils";

import * as address from "../core/address";
import * as graph from "../core/graph";
import * as weightedGraph from "../core/weightedGraph";
import * as weights from "../core/weights";
import * as graphToMarkovChain from "../core/algorithm/graphToMarkovChain";
import * as markovChain from "../core/algorithm/markovChain";
import * as credGraph from "../core/credrank/credGraph";
import * as ledger from "../core/ledger/ledger";
import * as ledgerUtils from "../core/ledger/utils";
import * as grain from "../core/ledger/grain";
import * as identity from "../core/identity";

import * as manager from "./ledgerManager";
import * as storage from "./ledgerStorage";
import * as credrank from "./main/credrank";

const api = {
  api: {
    credrank,
  },
  core: {
    address,
    algorithm: {
      markovChain,
      graphToMarkovChain,
    },
    graph,
    weightedGraph,
    weights,
    credGraph,
  },
  ledger: {
    ledger,
    identity,
    grain,
    utils: ledgerUtils,
    manager,
    storage,
  },
  plugins: {
    github: {
      declaration: githubDeclaration,
      edges: githubEdges,
      nodes: githubNodes,
    },
    ethereum: {
      declaration: ethereumDeclaration,
      utils: ethereumUtils,
    },
    discourse: {
      address: discourseAddress,
      declaration: discourseDeclaration,
    },
    discord: {
      declaration: discordDeclaration,
      utils: discordUtils,
    },
    initiatives: {
      declaration: initiativesDeclaration,
    },
  },
};

export default (deepFreeze(api): typeof api);
