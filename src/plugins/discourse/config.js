// @flow

import * as Combo from "../../util/combo";
import {optionsShapeParser, type MirrorOptions} from "./mirror";

export type DiscourseConfig = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

const parser: Combo.Parser<DiscourseConfig> = (() => {
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

export function parseConfig(raw: Combo.JsonObject): DiscourseConfig {
  return parser.parseOrThrow(raw);
}
