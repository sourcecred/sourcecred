// @flow

import {Graph} from "../../core/graph";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as A from "./addressify";
import {createEdge} from "./edges";

export function createGraph(addressedData: A.DataAddressed): Graph {
  const creator = new GraphCreator(addressedData);
  return creator.graph;
}

class GraphCreator {
  graph: Graph;

  constructor(data: A.DataAddressed) {
    this.graph = new Graph();
    for (const r of data.repos) {
      this.addRepo(r);
    }
  }

  addNode(addr: N.StructuredAddress) {
    this.graph.addNode(N.toRaw(addr));
  }

  addRepo(entry: A.RepoAddressed) {
    this.addNode(entry.address);
    entry.issues.forEach((e) => this.addIssue(e));
    entry.pulls.forEach((e) => this.addPull(e));
  }

  addIssue(entry: A.IssueAddressed) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.repo);
    entry.comments.forEach((e) => this.addComment(e));
  }

  addPull(entry: A.PullAddressed) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.repo);
    entry.comments.forEach((e) => this.addComment(e));
    entry.reviews.forEach((e) => this.addReview(e));
    const commit = entry.mergedAs;
    if (commit != null) {
      this.graph.addNode(GitNode.toRaw(commit));
      this.graph.addEdge(createEdge.mergedAs(entry.address, commit));
    }
  }

  addReview(entry: A.ReviewAddressed) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.pull);
    entry.comments.forEach((e) => this.addComment(e));
  }

  addComment(entry: A.CommentAddressed) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.parent);
  }

  addAuthors(
    contentAddress: N.AuthorableAddress,
    nominalAuthor: ?A.UserlikeAddressed
  ) {
    if (nominalAuthor == null) {
      return;
    }
    this.addNode(nominalAuthor.address);
    this.graph.addEdge(
      createEdge.authors(nominalAuthor.address, contentAddress)
    );
  }

  addHasParent(child: N.ChildAddress, parent: N.ParentAddress) {
    this.graph.addEdge(createEdge.hasParent(child, parent));
  }
}
