// @flow
import React, {useState} from "react";
import {Ledger} from "../../ledger/ledger";
import {type Alias, type IdentityId} from "../../ledger/identity";
import {type NodeAddressT} from "../../core/graph";
import Markdown from "react-markdown";

import {makeStyles} from "@material-ui/core/styles";
import {List, ListItem} from "@material-ui/core";

type Props = {|
  +selectedIdentityId: IdentityId,
  +ledger: Ledger,
|};

const useStyles = makeStyles({
  element: {margin: "20px"},
  aliasesHeader: {margin: "20px", marginBottom: 0},
});

export function AliasView({selectedIdentityId, ledger}: Props) {
  const classes = useStyles();
  const selectedAccount = ledger.account(selectedIdentityId);
  if (selectedAccount == null) {
    throw new Error("Selected identity not present in ledger");
  }
  const [inputValue, setInputValue] = useState("");

  const claimedAddresses: Set<NodeAddressT> = new Set();
  for (const {identity} of ledger.accounts()) {
    claimedAddresses.add(identity.address);
    for (const {address} of identity.aliases) {
      claimedAddresses.add(address);
    }
  }

  return (
    <>
      <h3 className={classes.aliasesHeader}>Aliases:</h3>
      {selectedAccount.identity.aliases.length > 0 && (
        <List dense>
          {selectedAccount.identity.aliases.map((alias, index) => (
            <ListItem key={`selected-item-${index}`}>
              <Markdown
                renderers={{paragraph: "span"}}
                source={alias.description}
              />
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
