// @flow

import type {
  Userlike,
  Review,
  Repo,
  Pull,
  Issue,
  Commit,
  Comment,
} from "../relationalView";
import {RelationalView} from "../relationalView";
import type {Repository} from "../graphqlTypes";
import {type WeightedGraph} from "../../../core/weightedGraph";
import cloneDeep from "lodash.clonedeep";
import {createGraph} from "../createGraph";

export function exampleRepository(): Repository {
  return cloneDeep(require("./example-github"));
}

export function exampleRelationalView(): RelationalView {
  const rv = new RelationalView();
  rv.addRepository(exampleRepository());
  return rv;
}

export function exampleGraph(): WeightedGraph {
  return createGraph(exampleRelationalView());
}

export function exampleEntities(): {|
  comment: Comment,
  commit: Commit,
  issue: Issue,
  pull: Pull,
  repo: Repo,
  review: Review,
  userlike: Userlike,
|} {
  const view = exampleRelationalView();
  const repo = Array.from(view.repos())[0];
  const issue = Array.from(repo.issues())[1];
  const pull = Array.from(repo.pulls())[1];
  const review = Array.from(pull.reviews())[0];
  const comment = Array.from(review.comments())[0];
  const commit = Array.from(view.commits())[0];
  const userlike = Array.from(review.authors())[0];
  return {
    repo,
    issue,
    pull,
    review,
    comment,
    commit,
    userlike,
  };
}
