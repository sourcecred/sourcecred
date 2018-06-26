// @flow

import {Graph} from "../../core/graph";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as R from "./relationalView";
import {createEdge} from "./edges";

export function createGraph(view: R.RelationalView): Graph {
  const creator = new GraphCreator(view);
  return creator.graph;
}

class GraphCreator {
  graph: Graph;
  view: R.RelationalView;

  constructor(view: R.RelationalView) {
    this.graph = new Graph();
    this.view = view;
    for (const r of view.repos()) {
      this.addRepo(r);
    }
  }

  addNode(addr: N.StructuredAddress) {
    this.graph.addNode(N.toRaw(addr));
  }

  addRepo(entry: R.RepoEntry) {
    this.addNode(entry.address);
    entry.issues.forEach((e) => this.addIssue(e));
    entry.pulls.forEach((e) => this.addPull(e));
  }

  addIssue(entry: R.IssueEntry) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.repo);
    entry.comments.forEach((e) => this.addComment(e));
  }

  addPull(entry: R.PullEntry) {
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

  addReview(entry: R.ReviewEntry) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.pull);
    entry.comments.forEach((e) => this.addComment(e));
  }

  addComment(entry: R.CommentEntry) {
    this.addNode(entry.address);
    this.addAuthors(entry.address, entry.nominalAuthor);
    this.addHasParent(entry.address, entry.address.parent);
  }

  addAuthors(
    contentAddress: N.AuthorableAddress,
    nominalAuthor: ?R.UserlikeEntry
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
