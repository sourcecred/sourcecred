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

  return (
    <>
      {selectedAccount.identity.aliases.length > 0 && (
        <>
          <h3 className={classes.aliasesHeader}>Aliases:</h3>
          <List dense>
            {selectedAccount.identity.aliases.map((alias, index) => (
              <ListItem key={alias.address}>
                <Markdown
                  renderers={{paragraph: "span"}}
                  source={alias.description}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </>
  );
}
