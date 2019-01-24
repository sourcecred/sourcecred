// @flow

import stringify from "json-stable-stringify";
import deepEqual from "lodash.isequal";

import * as GN from "./nodes";
import * as GE from "./edges";

import * as GitNode from "../git/nodes";
import {ReactionContent$Values as Reactions} from "./graphqlTypes";

import {
  Graph,
  type NodeAddressT,
  Direction,
  type NeighborsOptions,
  NodeAddress,
  edgeToString,
} from "../../core/graph";

export class GraphView {
  _graph: Graph;
  _isCheckingInvariants: boolean;

  constructor(graph: Graph) {
    this._graph = graph;
    this._isCheckingInvariants = false;
    this._maybeCheckInvariants();
  }

  graph(): Graph {
    this._maybeCheckInvariants();
    return this._graph;
  }

  *_nodes<T: GN.StructuredAddress>(prefix: GN.RawAddress): Iterator<T> {
    for (const n of this._graph.nodes({prefix})) {
      const structured = GN.fromRaw((n: any));
      this._maybeCheckInvariants();
      yield (structured: any);
    }
    this._maybeCheckInvariants();
  }

  *_neighbors<T: GN.StructuredAddress>(
    node: GN.StructuredAddress,
    options: NeighborsOptions
  ): Iterator<T> {
    if (!NodeAddress.hasPrefix(options.nodePrefix, GN.Prefix.base)) {
      throw new Error(`_neighbors must filter to GitHub nodes`);
    }
    const rawNode = GN.toRaw(node);
    for (const neighbor of this._graph.neighbors(rawNode, options)) {
      this._maybeCheckInvariants();
      yield (GN.fromRaw((neighbor.node: any)): any);
    }
    this._maybeCheckInvariants();
  }

  _children<T: GN.StructuredAddress>(
    node: GN.StructuredAddress,
    nodePrefix: GN.RawAddress
  ): Iterator<T> {
    const options = {
      nodePrefix,
      edgePrefix: GE.Prefix.hasParent,
      direction: Direction.IN,
    };
    return this._neighbors(node, options);
  }

  repos(): Iterator<GN.RepoAddress> {
    return this._nodes(GN.Prefix.repo);
  }

  issues(repo: GN.RepoAddress): Iterator<GN.IssueAddress> {
    return this._children(repo, GN.Prefix.issue);
  }

  pulls(repo: GN.RepoAddress): Iterator<GN.PullAddress> {
    return this._children(repo, GN.Prefix.pull);
  }

  comments(commentable: GN.CommentableAddress): Iterator<GN.CommentAddress> {
    return this._children(commentable, GN.Prefix.comment);
  }

  reviews(pull: GN.PullAddress): Iterator<GN.ReviewAddress> {
    return this._children(pull, GN.Prefix.review);
  }

  // TODO(@wchrgin) figure out how to overload this fn signature
  parent(child: GN.ChildAddress): GN.ParentAddress {
    const options = {
      direction: Direction.OUT,
      edgePrefix: GE.Prefix.hasParent,
      nodePrefix: GN.Prefix.base,
    };
    const parents: GN.ParentAddress[] = Array.from(
      this._neighbors(child, options)
    );
    if (parents.length !== 1) {
      throw new Error(
        `Parent invariant violated for child: ${stringify(child)}`
      );
    }
    return parents[0];
  }

  authors(content: GN.AuthorableAddress): Iterator<GN.UserlikeAddress> {
    const options = {
      direction: Direction.IN,
      edgePrefix: GE.Prefix.authors,
      nodePrefix: GN.Prefix.userlike,
    };
    return this._neighbors(content, options);
  }

  _maybeCheckInvariants() {
    if (this._isCheckingInvariants) {
      return;
    }
    if (process.env.NODE_ENV === "test") {
      // TODO(perf): If this method becomes really slow, we can disable
      // it on specific tests wherein we construct large graphs.
      this.checkInvariants();
    }
  }

  checkInvariants() {
    this._isCheckingInvariants = true;
    try {
      this._checkInvariants();
    } finally {
      this._isCheckingInvariants = false;
    }
  }

  _checkInvariants() {
    const nodeTypeToParentAccessor = {
      [GN.REPO_TYPE]: null,
      [GN.ISSUE_TYPE]: (x) => x.repo,
      [GN.PULL_TYPE]: (x) => x.repo,
      [GN.COMMENT_TYPE]: (x) => x.parent,
      [GN.REVIEW_TYPE]: (x) => x.pull,
      [GN.USERLIKE_TYPE]: null,
      [GitNode.COMMIT_TYPE]: null,
    };
    for (const node of this._graph.nodes({prefix: GN.Prefix.base})) {
      const structuredNode = GN.fromRaw((node: any));
      const type = structuredNode.type;
      const parentAccessor = nodeTypeToParentAccessor[type];
      if (parentAccessor != null) {
        // this.parent will throw error if there is not exactly 1 parent
        const parent = this.parent((structuredNode: any));
        const expectedParent = parentAccessor((structuredNode: any));
        if (!deepEqual(parent, expectedParent)) {
          throw new Error(`${stringify(structuredNode)} has the wrong parent`);
        }
      }
    }

    type Hom = {|
      +srcPrefix: NodeAddressT,
      +dstPrefix: NodeAddressT,
    |};
    function homProduct(
      srcPrefixes: NodeAddressT[],
      dstPrefixes: NodeAddressT[]
    ): Hom[] {
      const result = [];
      for (const srcPrefix of srcPrefixes) {
        for (const dstPrefix of dstPrefixes) {
          result.push({srcPrefix, dstPrefix});
        }
      }
      return result;
    }
    type EdgeInvariant = {|
      +homs: Hom[],
      +srcAccessor?: (GE.StructuredAddress) => NodeAddressT,
      +dstAccessor?: (GE.StructuredAddress) => NodeAddressT,
    |};
    const edgeTypeToInvariants: {[type: string]: EdgeInvariant} = {
      [GE.HAS_PARENT_TYPE]: {
        homs: [
          {srcPrefix: GN.Prefix.issue, dstPrefix: GN.Prefix.repo},
          {srcPrefix: GN.Prefix.pull, dstPrefix: GN.Prefix.repo},
          {srcPrefix: GN.Prefix.review, dstPrefix: GN.Prefix.pull},
          {srcPrefix: GN.Prefix.reviewComment, dstPrefix: GN.Prefix.review},
          {srcPrefix: GN.Prefix.issueComment, dstPrefix: GN.Prefix.issue},
          {srcPrefix: GN.Prefix.pullComment, dstPrefix: GN.Prefix.pull},
        ],
        srcAccessor: (x) => GN.toRaw((x: any).child),
      },
      [GE.MERGED_AS_TYPE]: {
        homs: [
          {
            srcPrefix: GN.Prefix.pull,
            dstPrefix: GitNode.Prefix.commit,
          },
        ],
        srcAccessor: (x) => GN.toRaw((x: any).pull),
      },
      [GE.REFERENCES_TYPE]: {
        homs: homProduct(
          [
            GN.Prefix.issue,
            GN.Prefix.pull,
            GN.Prefix.review,
            GN.Prefix.comment,
            GitNode.Prefix.commit,
          ],
          [
            GN.Prefix.repo,
            GN.Prefix.issue,
            GN.Prefix.pull,
            GN.Prefix.review,
            GN.Prefix.comment,
            GN.Prefix.userlike,
            GitNode.Prefix.commit,
          ]
        ),
        srcAccessor: (x) => GN.toRaw((x: any).referrer),
        dstAccessor: (x) => GN.toRaw((x: any).referent),
      },
      [GE.AUTHORS_TYPE]: {
        homs: homProduct(
          [GN.Prefix.userlike],
          [
            GN.Prefix.issue,
            GN.Prefix.review,
            GN.Prefix.pull,
            GN.Prefix.comment,
            GitNode.Prefix.commit,
          ]
        ),
        srcAccessor: (x) => GN.toRaw((x: any).author),
        dstAccessor: (x) => GN.toRaw((x: any).content),
      },
      [GE.MENTIONS_AUTHOR_TYPE]: {
        homs: homProduct(
          [GN.Prefix.issue, GN.Prefix.pull, GN.Prefix.comment],
          [GN.Prefix.issue, GN.Prefix.pull, GN.Prefix.comment]
        ),
        srcAccessor: (x) => GN.toRaw((x: any).reference.src),
        dstAccessor: (x) => GN.toRaw((x: any).reference.dst),
      },
      [GE.REACTS_TYPE]: {
        homs: homProduct(
          [GN.Prefix.userlike],
          [GN.Prefix.issue, GN.Prefix.pull, GN.Prefix.comment]
        ),
        srcAccessor: (x) => GN.toRaw((x: any).user),
        dstAccessor: (x) => GN.toRaw((x: any).reactable),
      },
    };

    for (const edge of this._graph.edges({
      addressPrefix: GE.Prefix.base,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const address: GE.RawAddress = (edge.address: any);
      const structuredEdge = GE.fromRaw(address);
      const invariants = edgeTypeToInvariants[structuredEdge.type];
      if (invariants == null) {
        throw new Error(
          `Invariant: Unexpected edge type ${structuredEdge.type}`
        );
      }
      const {homs, srcAccessor, dstAccessor} = invariants;
      if (srcAccessor) {
        if (srcAccessor(structuredEdge) !== edge.src) {
          throw new Error(
            `Invariant: Expected src on edge ${edgeToString(
              edge
            )} to be ${srcAccessor(structuredEdge)}`
          );
        }
      }
      if (dstAccessor) {
        if (dstAccessor(structuredEdge) !== edge.dst) {
          throw new Error(
            `Invariant: Expected dst on edge ${edgeToString(
              edge
            )} to be ${dstAccessor(structuredEdge)}`
          );
        }
      }
      let foundHom = false;
      for (const {srcPrefix, dstPrefix} of homs) {
        if (
          NodeAddress.hasPrefix(edge.src, srcPrefix) &&
          NodeAddress.hasPrefix(edge.dst, dstPrefix)
        ) {
          foundHom = true;
          break;
        }
      }
      if (!foundHom) {
        throw new Error(
          `Invariant: Edge ${stringify(
            structuredEdge
          )} with edge ${edgeToString(
            edge
          )} did not satisfy src/dst prefix requirements`
        );
      }
    }

    for (const reactionEdge of this._graph.edges({
      addressPrefix: GE.Prefix.reacts,
      srcPrefix: NodeAddress.empty,
      dstPrefix: NodeAddress.empty,
    })) {
      const address: GE.RawAddress = (reactionEdge.address: any);
      const reactsAddress: GE.ReactsAddress = (GE.fromRaw(address): any);
      const {reactionType} = reactsAddress;
      if (
        reactionType !== Reactions.THUMBS_UP &&
        reactionType !== Reactions.HEART &&
        reactionType !== Reactions.HOORAY &&
        reactionType !== Reactions.ROCKET
      ) {
        throw new Error(
          `Invariant: Edge ${stringify(
            reactsAddress
          )} has unspported reactionType`
        );
      }
    }
  }
}
