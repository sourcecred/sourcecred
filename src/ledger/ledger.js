// @flow

import {type Log, ArrayLog} from "./log";
import {type User} from "./user";
import {type Event} from "./events";
import {type State as StateT} from "./state";
import * as State from "./state";
import * as Commands from "./commands";

// Yes, it's silly. I don't even import it really. Typically Iterable<Event> is enough.
export type Ledger = Log<Event>;

// Example of how to update the ledger and state in tandem when issuing a command.
export function trackUser(ledger: Ledger, user: User): Ledger {
  // First rebuild the state from events.
  const state = State.fromEvents(ledger);

  // Figure out events to add. May throw.
  const events = Commands.trackUser(state, user);

  // Append the events.
  ledger.append(events);

  // Make it easier to chain.
  return ledger;
}

// Or more generalized...
type CurriedCommand = (state: StateT) => $ReadOnlyArray<Event>;

const curried = {
  trackUser(user: User): CurriedCommand {
    return (state: StateT) => Commands.trackUser(state, user);
  },
};

function applyCommand(ledger: Ledger, command: CurriedCommand): Ledger {
  const state = State.fromEvents(ledger);
  const events = command(state);
  ledger.append(events);
  return ledger;
}

// Fake the user.
// $FlowExpectedError
const user: User = {};
const ledger: Ledger = new ArrayLog();

applyCommand(ledger, curried.trackUser(user));
