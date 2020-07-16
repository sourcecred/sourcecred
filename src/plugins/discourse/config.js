// @flow

import * as Combo from "../../util/combo";
import {optionsShapeParser, type MirrorOptions} from "./mirror";

export type DiscourseConfig = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
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
    }
  );
})();
