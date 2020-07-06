// @flow

import {type Log} from "./log";
import {type Event} from "./events";

// Yes, it's silly. I don't even import it really. Typically Iterable<Event> is enough.
export type Ledger = Log<Event>;
