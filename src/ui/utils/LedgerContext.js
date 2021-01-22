// @flow

import * as React from "react";
import {Ledger} from "../../core/ledger/ledger";
import {LedgerManager} from "../../api/ledgerManager";

const LedgerContext = React.createContext<LedgerContextValue>({
  ledger: new Ledger(),
  updateLedger: () => {},
});

type LedgerContextValue = {|
  +ledger: Ledger,
  updateLedger(ledger: Ledger): void,
|};

type LedgerProviderProps = {|
  +ledgerManager: LedgerManager,
  +children: React.Node,
|};

export const LedgerProvider = ({
  children,
  ledgerManager,
}: LedgerProviderProps): React.Node => {
  const [{ledger}, setLedgerState] = React.useState({
    ledger: ledgerManager.ledger,
  });

  // Workaround to trigger UI update in React since ledger object is mutable
  const updateLedger = (_?: Ledger) =>
    setLedgerState({ledger: ledgerManager.ledger});

  return (
    <LedgerContext.Provider value={{ledger, updateLedger}}>
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = (): LedgerContextValue => {
  return React.useContext(LedgerContext);
};
