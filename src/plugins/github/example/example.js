// @flow

import {RelationalView} from "../relationalView";
import type {GithubResponseJSON} from "../graphql";
import {Graph} from "../../../core/graph";
import cloneDeep from "lodash.clonedeep";
import {createGraph} from "../createGraph";

export function exampleData(): GithubResponseJSON {
  return cloneDeep(require("./example-github"));
}

export function exampleRelationalView(): RelationalView {
  const rv = new RelationalView();
  rv.addData(exampleData());
  return rv;
}

export function exampleGraph(): Graph {
  return createGraph(exampleRelationalView());
}

export function exampleEntities() {
  const view = exampleRelationalView();
  const repo = Array.from(view.repos())[0];
  const issue = Array.from(repo.issues())[1];
  const pull = Array.from(repo.pulls())[1];
  const review = Array.from(pull.reviews())[0];
  const comment = Array.from(review.comments())[0];
  const userlike = Array.from(review.authors())[0];
  return {
    repo,
    issue,
    pull,
    review,
    comment,
    userlike,
  };
}
