// @flow

import {type MirrorOptions} from "./mirror";

export type DiscourseServer = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};
