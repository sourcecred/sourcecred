// @flow

import CheckedLocalStore from "./checkedLocalStore";
import MemoryLocalStore from "./memoryLocalStore";

export default () => new CheckedLocalStore(new MemoryLocalStore());
