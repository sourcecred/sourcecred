// @flow

import * as React from "react";
import {Ledger} from "../../ledger/ledger";

const LedgerContext = React.createContext<LedgerContextValue>({
  ledger: new Ledger(),
  updateLedger: () => {},
});

type LedgerContextValue = {|
  +ledger: Ledger,
  updateLedger(ledger: Ledger): void,
|};

type LedgerProviderProps = {|
  +initialLedger: Ledger,
  +children: React.Node,
|};

export const LedgerProvider = ({
  children,
  initialLedger,
}: LedgerProviderProps) => {
  const [{ledger}, setLedgerState] = React.useState({ledger: initialLedger});

  const updateLedger = (ledger: Ledger) => setLedgerState({ledger});

  return (
    <LedgerContext.Provider value={{ledger, updateLedger}}>
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  return React.useContext(LedgerContext);
};
