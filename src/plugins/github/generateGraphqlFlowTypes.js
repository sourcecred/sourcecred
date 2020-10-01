// @flow

import prettier from "prettier";

import generateFlowTypes from "../../graphql/generateFlowTypes";
import schema from "./schema";

export default function generateGraphqlFlowTypes(): string {
  const prettierOptions = {
    parser: "babel",
    ...prettier.resolveConfig.sync(__filename),
  };
  return generateFlowTypes(schema(), prettierOptions);
}
