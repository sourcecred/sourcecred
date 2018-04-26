// @flow

import {Graph} from "../../core/graph";
import type {Node} from "../../core/graph";
import type {Address} from "../../core/address";
import type {
  NodePayload,
  EdgePayload,
  NodeType,
  IssueNodePayload,
  PullRequestNodePayload,
  CommentNodePayload,
  AuthorNodePayload,
  AuthorSubtype,
} from "./types";

import {
  CONTAINS_EDGE_TYPE,
  COMMENT_NODE_TYPE,
  AUTHORS_EDGE_TYPE,
  AUTHOR_NODE_TYPE,
  ISSUE_NODE_TYPE,
  PULL_REQUEST_NODE_TYPE,
} from "./types";

export class Repository {
  repositoryName: string;
  graph: Graph<NodePayload, EdgePayload>;

  constructor(repositoryName: string, graph: Graph<NodePayload, EdgePayload>) {
    this.repositoryName = repositoryName;
    this.graph = graph;
  }

  issueOrPRByNumber(number: number): ?(Issue | PullRequest) {
    let result: Issue | PullRequest;
    this.graph.nodes({type: ISSUE_NODE_TYPE}).forEach((n) => {
      if (n.payload.number === number) {
        result = new Issue(this.graph, n.address);
      }
    });
    this.graph.nodes({type: PULL_REQUEST_NODE_TYPE}).forEach((n) => {
      if (n.payload.number === number) {
        result = new PullRequest(this.graph, n.address);
      }
    });
    return result;
  }

  issues(): Issue[] {
    return this.graph
      .nodes({type: ISSUE_NODE_TYPE})
      .map((n) => new Issue(this.graph, n.address));
  }

  pullRequests(): PullRequest[] {
    return this.graph
      .nodes({type: PULL_REQUEST_NODE_TYPE})
      .map((n) => new PullRequest(this.graph, n.address));
  }

  authors(): Author[] {
    return this.graph
      .nodes({type: AUTHOR_NODE_TYPE})
      .map((n) => new Author(this.graph, n.address));
  }
}

class GithubEntity<T: NodePayload> {
  graph: Graph<NodePayload, EdgePayload>;
  nodeAddress: Address;

  constructor(graph: Graph<NodePayload, EdgePayload>, nodeAddress: Address) {
    this.graph = graph;
    this.nodeAddress = nodeAddress;
  }

  node(): Node<T> {
    return (this.graph.node(this.nodeAddress): Node<any>);
  }

  url(): string {
    return this.node().payload.url;
  }

  type(): NodeType {
    return (this.nodeAddress.type: any);
  }

  address(): Address {
    return this.nodeAddress;
  }
}

class Post<
  T: IssueNodePayload | PullRequestNodePayload | CommentNodePayload
> extends GithubEntity<T> {
  authors(): Author[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        edgeType: AUTHORS_EDGE_TYPE,
        nodeType: AUTHOR_NODE_TYPE,
      })
      .map(({neighborAddress}) => new Author(this.graph, neighborAddress));
  }

  body(): string {
    return this.node().payload.body;
  }
}

class Commentable<T: IssueNodePayload | PullRequestNodePayload> extends Post<
  T
> {
  comments(): Comment[] {
    return this.graph
      .neighborhood(this.nodeAddress, {
        edgeType: CONTAINS_EDGE_TYPE,
        nodeType: COMMENT_NODE_TYPE,
      })
      .map(({neighborAddress}) => new Comment(this.graph, neighborAddress));
  }
}

export class Author extends GithubEntity<AuthorNodePayload> {
  login(): string {
    return this.node().payload.login;
  }

  subtype(): AuthorSubtype {
    return this.node().payload.subtype;
  }
}

export class PullRequest extends Commentable<PullRequestNodePayload> {
  number(): number {
    return this.node().payload.number;
  }
  title(): string {
    return this.node().payload.title;
  }
}

export class Issue extends Commentable<IssueNodePayload> {
  number(): number {
    return this.node().payload.number;
  }
  title(): string {
    return this.node().payload.title;
  }
}

export class Comment extends Post<CommentNodePayload> {}
