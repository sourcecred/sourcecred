// @flow

import * as Combo from "../../util/combo";
import {optionsShapeParser, type MirrorOptions} from "./mirror";
import {
  type TagConfig,
  type CategoryConfig,
  tagConfigParser,
  categoryConfigParser,
} from "./weights";

export type DiscourseConfig = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
  /**
   * Categories can be configured to confer specific like-weight multipliers
   * when added to a Topic.
   * If a category does not have a configured weight, the deafaultWeight is applied.
   * An example configuration might look like:
   * "categoryWeights": {
   *   "defaultWeight": 1,
   *   "weights": {
   *     "5": 0,
   *     "36": 1.25
   *   }
   * }
   * where "5" and "36" are the categoryIds in discourse.
   *
   * An easy way to find the categoryId for a given category is to browse to the
   * categories section in discourse
   * (e.g. https://discourse.sourcecred.io/categories).
   * Then mousing over or clicking on a category will bring you to a url that
   * has the shape https://exampleUrl.com/c/<category name>/<categoryId>
   * Clicking on the community category in sourcecred navigates to
   * https://discourse.sourcecred.io/c/community/26 for example, where the
   * categoryId is 26
   */
  +categoryWeights?: CategoryConfig,
  /**
   * Tags can be configured to confer specific like-weight multipliers when
   * added to a Topic.
   * If a tag does not have a configured weight, the defaultWeight is applied.
   * An example configuration might look like:
   * "tagWeights": {
   *   "defaultWeight": 1,
   *   "weights": {
   *     "foo": 0,
   *     "bar": 1.25
   *   }
   * }
   * where foo and bar are the names of tags used in discourse.
   */
  +tagWeights?: TagConfig,
|};

export const parser: Combo.Parser<DiscourseConfig> = (() => {
  const C = Combo;
  return C.object(
    {
      serverUrl: C.fmap(C.string, (serverUrl) => {
        const httpRE = new RegExp(/^https?:\/\//);
        if (!httpRE.test(serverUrl)) {
          throw new Error(
            "expected server url to start with 'https://' or 'http://'"
          );
        }
        return serverUrl;
      }),
    },
    {
      mirrorOptions: optionsShapeParser,
      tagWeights: tagConfigParser,
      categoryWeights: categoryConfigParser,
    }
  );
})();
