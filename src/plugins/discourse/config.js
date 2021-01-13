// @flow

import * as C from "../../util/combo";
import {optionsShapeParser, type MirrorOptions} from "./mirror";
import {
  weightsConfigParser,
  serializedWeightsConfigParser,
  type WeightsConfig,
  type SerializedWeightsConfig,
} from "./weights";

export type SerializedDiscourseConfig = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
  +weights?: SerializedWeightsConfig,
|};

export type DiscourseConfig = {|
  +serverUrl: string,
  +weights: WeightsConfig,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

const serializedParser: C.Parser<SerializedDiscourseConfig> = C.object(
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
    weights: serializedWeightsConfigParser,
  }
);

export function upgrade(c: SerializedDiscourseConfig): DiscourseConfig {
  return {
    ...c,
    weights: weightsConfigParser.parseOrThrow(c.weights || {}),
  };
}

export const parser: C.Parser<DiscourseConfig> = C.fmap(
  serializedParser,
  upgrade
);
