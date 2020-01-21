// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";
import {type EdgeWeight} from "../core/weights";

/**
 * This module defines `NodeType`s and `EdgeType`s, both of which are
 * data structures containing shared metadata that describes many nodes or edges
 * in the graph. Nodes can be "members" of zero or more `NodeType`s, and edges can
 * be "members" of zero or more `EdgeType`s. Membership is determined based on the
 * type's `prefix`, which is an address. A node or edge is considered a member of
 * a type if that type's prefix is a prefix of the node's address.
 *
 * To make this more concrete, let's consider a specific example. Suppose we define
 * the following nodes:
 *
 * const pullNode = NodeAddress.fromParts(["github", "pull", "repo", "34"]);
 * const commitNode = NodeAddress.fromParts(["git", "commit", "e1337"]);
 * const pullType: NodeType = {
 *  name: "Pull request",
 *  prefix: NodeAddress.fromParts(["github", "pull"]),
 *  // ... more properties as required
 * };
 * const githubType: NodeType = {
 *   name: "GitHub node",
 *   prefix: NodeAddress.fromParts(["github"])
 * };
 *
 * Then the `pullNode` is considered a member of the `pullType` and `githubType`,
 * while the `commitNode` is not a member of either type.
 *
 * The concept of a "type" is useful to SourceCred because it let's us express
 * that groups of nodes are conceptually related, and that we should treat them similarly.
 * Most saliently, we use types to assign default weights to groups of nodes, and to
 * aggregate them for better UI organization. The fact that the SourceCred UI can group
 * all pull requests together, and assign a default weight to all of them, is possible
 * because the GitHub plugin defines a pull request node type.
 *
 * While a node or edge can theoretically be a member of multiple types, in practice we
 * generally treat the node or edge as though it is only a member of its most specific type.
 * In the example above, we would treat any individual pull request as though it is only
 * a member of the pull request node type. That may change in the future. In general,
 * the type system is not wholly finalized; when it does become finalized, we will
 * likely move it into src/core. See [#710] for context.
 *
 * [#710]: https://github.com/sourcecred/sourcecred/issues/710
 */

/**
 * Represents a "Type" of node in the graph. See the module docstring
 * for context.
 */
export type NodeType = {|
  // The name for an individual node of this type.
  // For example, for the GitHub PULL_REQUEST node type, the name is "Pull
  // request". The first letter of the name should be capitalized.
  +name: string,
  // The name for multiple nodes of this type.
  // For example, for the GitHub PULL_REQUEST node type, the pluralName is
  // "Pull requests". The first letter of this name should be capitalized.
  +pluralName: string,
  // The address that will be used to test whether a node is a member
  // of this NodeType. A given node `n` is a member of the type `t` if
  // `NodeAddress.hasPrefix(n, t.prefix) == true`
  +prefix: NodeAddressT,
  // The default weight to assign to nodes of this type. We use `1` to mean "of
  // normal importance", and the weights scale linearly from there (i.e. 2
  // means twice as important).
  +defaultWeight: number,
  // The `description` property should be a human-readable string that makes
  // it clear to a user what each NodeType does
  +description: string,
|};

/**
 * Represents a "Type" of edge in the graph. See the module docstring
 * for context.
 */
export type EdgeType = {|
  // A brief descriptive name of what the "forward" direction of the edge
  // means. For example, for the GitHub REFERENCES edge type, the forwardName
  // is "references"
  +forwardName: string,

  // A brief descriptive name of what the "backward" direction of the edge
  // means. For example, for the GitHub REFERENCES edge type, the backwardName
  // is "referenced by"
  +backwardName: string,

  // The default forwards and backwards weights for this edge.
  // We use `1` as a default value ("of normal importance").
  // The weights have linear importance, i.e. 2 is twice as important as 1.
  +defaultWeight: EdgeWeight,

  // The address that will be used to test whether an edge is a member
  // of this EdgeType. A given edge `e` is a member of the type `t` if
  // `EdgeAddress.hasPrefix(e.address, t.prefix) == true`
  +prefix: EdgeAddressT,

  // The `description` property should be a human-readable string that makes
  // it clear to a user what each EdgeType does.
  //
  // By convention, the first line of the description should be a sentence
  // beginning with the word "Connects", which describes what kinds of nodes
  // the edge connects and why. Optionally, you may provide examples and additional
  // context after one blank link. Here is an example (for the "Merged As" edge).
  //
  // ```js
  // const mergedAsDescription = dedent`\
  //  Connects a GitHub pull request to the Git commit it merged.
  //
  //  A pull request can have either one or zero Merged As edges, depending on
  //  whether or not it was ever merged.
  //  `
  // ```
  //
  // (Note the use of the `util/dedent.js` makes it easier to write multi-lined
  // strings with clean formatting.)
  +description: string,
|};

export type NodeAndEdgeTypes = {|
  +nodeTypes: NodeType[],
  +edgeTypes: EdgeType[],
|};
