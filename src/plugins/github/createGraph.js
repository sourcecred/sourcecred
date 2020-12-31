// @flow

import * as NullUtil from "../../util/null";
import {Graph} from "../../core/graph";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type WeightsT, empty as emptyWeightsT} from "../../core/weights";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as R from "./relationalView";
import {createEdge} from "./edges";
import {ReactionContent$Values as Reactions} from "./graphqlTypes";

export function createGraph(view: R.RelationalView): WeightedGraph {
  const creator = new GraphCreator();
  creator.addData(view);
  return {graph: creator.graph, weights: creator.weights};
}

class GraphCreator {
  graph: Graph;
  weights: WeightsT;

  constructor() {
    this.graph = new Graph();
    this.weights = emptyWeightsT();
  }

  addData(view: R.RelationalView) {
    for (const entity of view.entities()) {
      const address = N.toRaw(entity.address());
      this.graph.addNode({
        address,
        description: entity.description(),
        timestampMs: entity.timestampMs(),
      });
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
        const commitTimestamp = NullUtil.get(view.commit(commit)).timestampMs();
        this.graph.addEdge(
          createEdge.mergedAs(pull.address(), commit, commitTimestamp)
        );
      } else {
        const addr = N.toRaw(pull.address());
        // Un-merged PRs do not mint cred.
        this.weights.nodeWeightsT.set(addr, 0);
      }
    }

    for (const commit of view.commits()) {
      const gitCommitAddress: GitNode.CommitAddress = {
        type: GitNode.COMMIT_TYPE,
        hash: commit.hash(),
      };
      this.graph.addEdge(
        createEdge.correspondsToCommit(
          commit.address(),
          gitCommitAddress,
          commit.timestampMs()
        )
      );
    }

    for (const referrer of view.textContentEntities()) {
      for (const referent of referrer.references()) {
        this.graph.addEdge(
          createEdge.references(
            referrer.address(),
            referent.address(),
            referrer.timestampMs()
          )
        );
      }
    }

    for (const reactable of view.reactableEntities()) {
      for (const {content, user, timestampMs} of reactable.reactions()) {
        // We only support unambiguously positive reactions for now
        if (
          content === Reactions.THUMBS_UP ||
          content === Reactions.HEART ||
          content === Reactions.HOORAY ||
          content === Reactions.ROCKET
        ) {
          this.graph.addEdge(
            createEdge.reacts(content, user, reactable.address(), timestampMs)
          );
        }
      }
    }
  }

  addAuthors(entity: R.AuthoredEntity) {
    for (const author of entity.authors()) {
      this.graph.addEdge(
        createEdge.authors(
          author.address(),
          entity.address(),
          entity.timestampMs()
        )
      );
    }
  }

  addHasParent(child: R.Issue | R.Pull | R.Comment | R.Review) {
    this.graph.addEdge(
      createEdge.hasParent(
        child.address(),
        child.parent().address(),
        child.timestampMs()
      )
    );
  }
}
