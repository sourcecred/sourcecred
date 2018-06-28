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
  return new RelationalView(exampleData());
}

export function exampleGraph(): Graph {
  return createGraph(exampleRelationalView());
}
