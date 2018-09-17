// @flow

import {Graph} from "../../core/graph";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as R from "./relationalView";
import {createEdge} from "./edges";
import {findMentionsAuthorReferences} from "./heuristics/mentionsAuthorReference";
// TODO(@decentralion): Opportunity to reduce bundle size
import {Reactions} from "./graphql";

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

    for (const reactable of view.reactableEntities()) {
      for (const {content, user} of reactable.reactions()) {
        // We only support unambiguously positive reactions for now
        if (
          content === Reactions.THUMBS_UP ||
          content === Reactions.HEART ||
          content === Reactions.HOORAY
        ) {
          this.graph.addEdge(
            createEdge.reacts(content, user, reactable.address())
          );
        }
      }
    }

    for (const mentionsAuthorReference of findMentionsAuthorReferences(view)) {
      this.graph.addEdge(createEdge.mentionsAuthor(mentionsAuthorReference));
    }
  }

  addNode(addr: N.StructuredAddress) {
    this.graph.addNode(N.toRaw(addr));
  }

  addAuthors(entity: R.AuthoredEntity) {
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
