// @flow

import CheckedLocalStore from "./checkedLocalStore";
import MemoryLocalStore from "./memoryLocalStore";

export default (): CheckedLocalStore =>
  new CheckedLocalStore(new MemoryLocalStore());
