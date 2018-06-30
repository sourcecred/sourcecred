// @flow

import {Graph} from "../../core/graph";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as R from "./relationalView";
import {createEdge} from "./edges";

export function createGraph(view: R.RelationalView): Graph {
  const creator = new GraphCreator();
  creator.addData(view);
  return creator.graph;
}

class GraphCreator {
  graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addData(view: R.RelationalView) {
    for (const entity of view.entities()) {
      this.addNode(entity.address());
    }

    for (const child of view.childEntities()) {
      this.addHasParent(child);
    }

    for (const authored of view.authoredEntities()) {
      this.addAuthors(authored);
    }

    for (const pull of view.pulls()) {
      const commit = pull.mergedAs();
      if (commit != null) {
        this.graph.addNode(GitNode.toRaw(commit));
        this.graph.addEdge(createEdge.mergedAs(pull.address(), commit));
      }
    }

    for (const referrer of view.textContentEntities()) {
      for (const referent of referrer.references()) {
        this.graph.addEdge(
          createEdge.references(referrer.address(), referent.address())
        );
      }
    }
  }

  addNode(addr: N.StructuredAddress) {
    this.graph.addNode(N.toRaw(addr));
  }

  addAuthors(entity: R.Issue | R.Pull | R.Comment | R.Review) {
    for (const author of entity.authors()) {
      this.graph.addEdge(
        createEdge.authors(author.address(), entity.address())
      );
    }
  }

  addHasParent(child: R.Issue | R.Pull | R.Comment | R.Review) {
    this.graph.addEdge(
      createEdge.hasParent(child.address(), child.parent().address())
    );
  }
}
