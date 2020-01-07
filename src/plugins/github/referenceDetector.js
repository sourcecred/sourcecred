// @flow

import {MappedReferenceDetector} from "../../core/references";
import {RelationalView} from "./relationalView";

export function fromRelationalView(
  view: RelationalView
): GithubReferenceDetector {
  return new GithubReferenceDetector(view.urlReferenceMap());
}

export const GithubReferenceDetector = MappedReferenceDetector;
