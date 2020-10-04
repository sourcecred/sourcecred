// @flow

import * as React from "react";
import {Ledger} from "../../core/ledger/ledger";

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
}: LedgerProviderProps): React.Node => {
  const [{ledger}, setLedgerState] = React.useState({ledger: initialLedger});

  const updateLedger = (ledger: Ledger) => setLedgerState({ledger});

  return (
    <LedgerContext.Provider value={{ledger, updateLedger}}>
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = (): LedgerContextValue => {
  return React.useContext(LedgerContext);
};
