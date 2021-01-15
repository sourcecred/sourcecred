// @flow

import * as React from "react";
import {Ledger} from "../../core/ledger/ledger";
import {LedgerManager} from "../../api/ledgerManager";

const LedgerContext = React.createContext<LedgerContextValue>({
  ledger: new Ledger(),
  updateLedger: () => {},
  saveToDisk: () => Promise.resolve(),
});

type LedgerContextValue = {|
  +ledger: Ledger,
  updateLedger(ledger: Ledger): void,
  saveToDisk(): Promise<void>,
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

  const saveToDisk = async () => {
    try {
      const res = await ledgerManager.persist();
      if (res.error) {
        alert(`Failed to save ledger: ${res.error}`);
        return;
      }
      alert("Ledger saved to disk");
    } catch (e) {
      alert(`Failed to save ledger: ${e.message}`);
    }
  };

  return (
    <LedgerContext.Provider value={{ledger, updateLedger, saveToDisk}}>
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = (): LedgerContextValue => {
  return React.useContext(LedgerContext);
};
