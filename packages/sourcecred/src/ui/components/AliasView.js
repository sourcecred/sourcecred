// @flow

import React, {type Node as ReactNode} from "react";
import {type IdentityId} from "../../core/identity";
import Markdown from "react-markdown";
import {makeStyles} from "@material-ui/core/styles";

import {List, ListItem} from "@material-ui/core";
import {useLedger} from "../utils/LedgerContext";

type Props = {|
  +selectedId: IdentityId,
|};

const useStyles = makeStyles((theme) => {
  return {
    markdown: {
      "& a": {
        color: theme.palette.blue,
      },
    },
  };
});

export function AliasView({selectedId}: Props): ReactNode {
  const {ledger} = useLedger();
  const selectedAccount = ledger.account(selectedId);
  const classes = useStyles();

  return (
    <>
      {selectedAccount.identity.aliases.length > 0 && (
        <>
          <h3>Aliases:</h3>
          <List dense>
            {selectedAccount.identity.aliases.map((alias) => (
              <ListItem key={alias.address}>
                <Markdown
                  className={classes.markdown}
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
