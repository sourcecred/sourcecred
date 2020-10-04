// @flow

import * as C from "../../util/combo";
import * as Uuid from "../../util/uuid";
import {type TimestampMs} from "../../util/timestamp";
import {type Allocation, allocationParser} from "./grainAllocation";

export type Distribution = {|
  +id: Uuid.Uuid,
  +allocations: $ReadOnlyArray<Allocation>,
  +credTimestamp: TimestampMs,
|};

export const parser: C.Parser<Distribution> = C.object({
  id: Uuid.parser,
  allocations: C.array(allocationParser),
  credTimestamp: C.number,
});
