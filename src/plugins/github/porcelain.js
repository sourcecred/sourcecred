// @flow

/*
 * This module contains "Porcelain" for working with GitHub graphs. By
 * "Porcelain", we mean it is a much more convenient and polished API. It
 * allows accessing GitHub graph data via a familiar object-oriented API,
 * rather than needing to use the specific graph-based methods in the
 * underlying graph.
 *
 * In general, the porcelain module provides wrapper objects that contain the
 * entire GitHub graph, and a pointer to a particular entity in that graph.
 * Creating the wrappers is extremely cheap; all actual computation (e.g.
 * finding the body or author of a post) is done lazily when that information
 * is requested.
 */
import stringify from "json-stable-stringify";

import type {Address} from "../../core/address";
import {Graph} from "../../core/graph";
import {NodeReference, NodePorcelain} from "../../core/porcelain";
import type {
  AuthorNodePayload,
  AuthorSubtype,
  CommentNodePayload,
  EdgePayload,
  IssueNodePayload,
  MergedAsEdgePayload,
  NodePayload,
  NodeType,
  PullRequestNodePayload,
  PullRequestReviewCommentNodePayload,
  PullRequestReviewNodePayload,
  PullRequestReviewState,
  RepositoryNodePayload,
} from "./types";

import {
  AUTHORS_EDGE_TYPE,
  AUTHOR_NODE_TYPE,
  COMMENT_NODE_TYPE,
  CONTAINS_EDGE_TYPE,
  ISSUE_NODE_TYPE,
  MERGED_AS_EDGE_TYPE,
  PULL_REQUEST_NODE_TYPE,
  PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
  PULL_REQUEST_REVIEW_NODE_TYPE,
  REFERENCES_EDGE_TYPE,
  REPOSITORY_NODE_TYPE,
} from "./types";

import {PLUGIN_NAME} from "./pluginName";

import {COMMIT_NODE_TYPE} from "../git/types";

function assertAddressType(address: Address, t: NodeType) {
  if (address.type !== t) {
    throw new Error(
      `Expected entity at ${stringify(address)} to have type ${t}`
    );
  }
}

function asGithubReference(
  ref: NodeReference<any>
): GithubReference<NodePayload> {
  const addr = ref.address();
  if (addr.pluginName !== PLUGIN_NAME) {
    throw new Error(
      `Tried to make GitHub porcelain, but got the wrong plugin name: ${stringify(
        addr
      )}`
    );
  }
  const type: NodeType = (addr.type: any);
  switch (type) {
    case "ISSUE":
      return new IssueReference(ref);
    case "PULL_REQUEST":
      return new PullRequestReference(ref);
    case "COMMENT":
      return new CommentReference(ref);
    case "AUTHOR":
      return new AuthorReference(ref);
    case "PULL_REQUEST_REVIEW":
      return new PullRequestReviewReference(ref);
    case "PULL_REQUEST_REVIEW_COMMENT":
      return new PullRequestReviewCommentReference(ref);
    case "REPOSITORY":
      return new RepositoryReference(ref);
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(
        `Tried to make GitHub porcelain, but got invalid type: ${stringify(
          addr
        )}`
      );
  }
}

export class GraphPorcelain {
  graph: Graph<NodePayload, EdgePayload>;

  constructor(graph: Graph<NodePayload, EdgePayload>) {
    this.graph = graph;
  }

  /* Return all the repositories in the graph */
  repositories(): RepositoryReference[] {
    return this.graph
      .nodes({type: REPOSITORY_NODE_TYPE})
      .map(
        (n) => new RepositoryReference(new NodeReference(this.graph, n.address))
      );
  }

  /* Return the repository with the given owner and name */
  repository(owner: string, name: string): ?RepositoryReference {
    for (const repo of this.repositories()) {
      const repoNode = repo.get();
      if (
        repoNode != null &&
        repoNode.owner() === owner &&
        repoNode.name() === name
      ) {
        return repo;
      }
    }
  }
}

export class GithubReference<+T: NodePayload> extends NodeReference<T> {
  constructor(ref: NodeReference<any>) {
    const addr = ref.address();
    if (addr.pluginName !== PLUGIN_NAME) {
      throw new Error(
        `Wrong plugin name ${addr.pluginName} for GitHub plugin!`
      );
    }
    super(ref.graph(), addr);
  }

  type(): NodeType {
    return ((super.type(): string): any);
  }

  get(): ?GithubPorcelain<T> {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new GithubPorcelain(nodePorcelain);
    }
  }
}

export class GithubPorcelain<+T: NodePayload> extends NodePorcelain<T> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    if (nodePorcelain.ref().address().pluginName !== PLUGIN_NAME) {
      throw new Error(
        `Wrong plugin name ${
          nodePorcelain.ref().address().pluginName
        } for GitHub plugin!`
      );
    }
    super(nodePorcelain.ref(), nodePorcelain.node());
  }

  url(): string {
    return this.payload().url;
  }
}

export class RepositoryReference extends GithubReference<
  RepositoryNodePayload
> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), REPOSITORY_NODE_TYPE);
  }

  issueByNumber(number: number): ?IssueReference {
    const neighbors = this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      direction: "OUT",
      nodeType: ISSUE_NODE_TYPE,
    });
    for (const {ref} of neighbors) {
      const issueRef = new IssueReference(ref);
      const node = issueRef.get();
      if (node != null && node.number() === number) {
        return issueRef;
      }
    }
  }

  pullRequestByNumber(number: number): ?PullRequestReference {
    const neighbors = this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      direction: "OUT",
      nodeType: PULL_REQUEST_NODE_TYPE,
    });
    for (const {ref} of neighbors) {
      const pullRequest = new PullRequestReference(ref);
      const node = pullRequest.get();
      if (node != null && node.number() === number) {
        return pullRequest;
      }
    }
  }

  issues(): IssueReference[] {
    return this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      direction: "OUT",
      nodeType: ISSUE_NODE_TYPE,
    }).map(({ref}) => new IssueReference(ref));
  }

  pullRequests(): PullRequestReference[] {
    return this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      direction: "OUT",
      nodeType: PULL_REQUEST_NODE_TYPE,
    }).map(({ref}) => new PullRequestReference(ref));
  }

  get(): ?RepositoryPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new RepositoryPorcelain(nodePorcelain);
    }
  }
}

export class RepositoryPorcelain extends GithubPorcelain<
  RepositoryNodePayload
> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), REPOSITORY_NODE_TYPE);
    super(nodePorcelain);
  }

  owner(): string {
    return this.payload().owner;
  }

  name(): string {
    return this.payload().name;
  }

  ref(): RepositoryReference {
    return new RepositoryReference(super.ref());
  }
}

class PostReference<
  T:
    | IssueNodePayload
    | PullRequestNodePayload
    | CommentNodePayload
    | PullRequestReviewNodePayload
    | PullRequestReviewCommentNodePayload
> extends GithubReference<T> {
  authors(): AuthorReference[] {
    return this.neighbors({
      edgeType: AUTHORS_EDGE_TYPE,
      nodeType: AUTHOR_NODE_TYPE,
    }).map(({ref}) => new AuthorReference(ref));
  }

  references(): GithubReference<NodePayload>[] {
    return this.neighbors({
      edgeType: REFERENCES_EDGE_TYPE,
      direction: "OUT",
    }).map(({ref}) => asGithubReference(ref));
  }
}

class PostPorcelain<
  T:
    | IssueNodePayload
    | PullRequestNodePayload
    | CommentNodePayload
    | PullRequestReviewNodePayload
    | PullRequestReviewCommentNodePayload
> extends GithubPorcelain<T> {
  body(): string {
    return this.payload().body;
  }
}

class CommentableReference<
  T: IssueNodePayload | PullRequestNodePayload
> extends PostReference<T> {
  comments(): CommentReference[] {
    return this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      nodeType: COMMENT_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new CommentReference(ref));
  }
}

export class AuthorReference extends GithubReference<AuthorNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), AUTHOR_NODE_TYPE);
  }

  get(): ?AuthorPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new AuthorPorcelain(nodePorcelain);
    }
  }
}

export class AuthorPorcelain extends GithubPorcelain<AuthorNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), AUTHOR_NODE_TYPE);
    super(nodePorcelain);
  }
  login(): string {
    return this.payload().login;
  }

  subtype(): AuthorSubtype {
    return this.payload().subtype;
  }

  ref(): AuthorReference {
    return new AuthorReference(super.ref());
  }
}

export class PullRequestReference extends CommentableReference<
  PullRequestNodePayload
> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), PULL_REQUEST_NODE_TYPE);
  }

  parent(): RepositoryReference {
    return (_parent(this): any);
  }

  reviews(): PullRequestReviewReference[] {
    return this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      nodeType: PULL_REQUEST_REVIEW_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new PullRequestReviewReference(ref));
  }

  mergeCommitHash(): ?string {
    const mergeEdge = this.neighbors({
      edgeType: MERGED_AS_EDGE_TYPE,
      nodeType: COMMIT_NODE_TYPE,
      direction: "OUT",
    }).map(({edge}) => edge);
    if (mergeEdge.length > 1) {
      throw new Error(
        `Node at ${stringify(this.address())} has too many MERGED_AS edges`
      );
    }
    if (mergeEdge.length === 0) {
      return null;
    }
    const payload: MergedAsEdgePayload = (mergeEdge[0].payload: any);
    return payload.hash;
  }

  get(): ?PullRequestPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new PullRequestPorcelain(nodePorcelain);
    }
  }
}

export class PullRequestPorcelain extends PostPorcelain<
  PullRequestNodePayload
> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), PULL_REQUEST_NODE_TYPE);
    super(nodePorcelain);
  }
  number(): number {
    return this.payload().number;
  }

  title(): string {
    return this.payload().title;
  }

  ref(): PullRequestReference {
    return new PullRequestReference(super.ref());
  }
}

export class IssueReference extends CommentableReference<IssueNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), ISSUE_NODE_TYPE);
  }

  parent(): RepositoryReference {
    return (_parent(this): any);
  }

  get(): ?IssuePorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new IssuePorcelain(nodePorcelain);
    }
  }
}

export class IssuePorcelain extends PostPorcelain<IssueNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), ISSUE_NODE_TYPE);
    super(nodePorcelain);
  }
  number(): number {
    return this.payload().number;
  }

  title(): string {
    return this.payload().title;
  }

  ref(): IssueReference {
    return new IssueReference(super.ref());
  }
}

export class CommentReference extends PostReference<CommentNodePayload> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), COMMENT_NODE_TYPE);
  }

  parent(): IssueReference | PullRequestReference {
    return (_parent(this): any);
  }

  get(): ?CommentPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new CommentPorcelain(nodePorcelain);
    }
  }
}

export class CommentPorcelain extends PostPorcelain<CommentNodePayload> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(nodePorcelain.ref().address(), COMMENT_NODE_TYPE);
    super(nodePorcelain);
  }
  ref(): CommentReference {
    return new CommentReference(super.ref());
  }
}

export class PullRequestReviewReference extends PostReference<
  PullRequestReviewNodePayload
> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), PULL_REQUEST_REVIEW_NODE_TYPE);
  }

  parent(): PullRequestReference {
    return (_parent(this): any);
  }

  comments(): PullRequestReviewCommentReference[] {
    return this.neighbors({
      edgeType: CONTAINS_EDGE_TYPE,
      nodeType: PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
      direction: "OUT",
    }).map(({ref}) => new PullRequestReviewCommentReference(ref));
  }

  get(): ?PullRequestReviewPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new PullRequestReviewPorcelain(nodePorcelain);
    }
  }
}

export class PullRequestReviewPorcelain extends PostPorcelain<
  PullRequestReviewNodePayload
> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(
      nodePorcelain.ref().address(),
      PULL_REQUEST_REVIEW_NODE_TYPE
    );
    super(nodePorcelain);
  }

  state(): PullRequestReviewState {
    return this.payload().state;
  }

  ref(): PullRequestReviewReference {
    return new PullRequestReviewReference(super.ref());
  }
}

export class PullRequestReviewCommentReference extends PostReference<
  PullRequestReviewCommentNodePayload
> {
  constructor(ref: NodeReference<any>) {
    super(ref);
    assertAddressType(ref.address(), PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE);
  }

  parent(): PullRequestReviewReference {
    return (_parent(this): any);
  }

  get(): ?PullRequestReviewCommentPorcelain {
    const nodePorcelain = super.get();
    if (nodePorcelain != null) {
      return new PullRequestReviewCommentPorcelain(nodePorcelain);
    }
  }
}

export class PullRequestReviewCommentPorcelain extends PostPorcelain<
  PullRequestReviewCommentNodePayload
> {
  constructor(nodePorcelain: NodePorcelain<any>) {
    assertAddressType(
      nodePorcelain.ref().address(),
      PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE
    );
    super(nodePorcelain);
  }
  ref(): PullRequestReviewCommentReference {
    return new PullRequestReviewCommentReference(super.ref());
  }
}

function _parent(
  x: GithubReference<NodePayload>
): GithubReference<NodePayload> {
  const parents = x.neighbors({edgeType: CONTAINS_EDGE_TYPE, direction: "IN"});
  if (parents.length !== 1) {
    throw new Error(`Bad parent relationships for ${stringify(x.address())}`);
  }
  return asGithubReference(parents[0].ref);
}
