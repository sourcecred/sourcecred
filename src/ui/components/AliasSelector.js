// @flow
import React, {useState, useEffect} from "react";
import {type Alias, type IdentityId} from "../../ledger/identity";
import {CredView} from "../../analysis/credView";
import {type NodeAddressT} from "../../core/graph";
import Markdown from "react-markdown";
import removeMd from "remove-markdown";

import {makeStyles} from "@material-ui/core/styles";
import {List, ListItem, TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";
import {useLedger} from "../utils/LedgerContext";

type Props = {|
  +selectedIdentityId: IdentityId,
  +credView: CredView,
|};

const useStyles = makeStyles({
  element: {margin: "20px"},
  aliasesHeader: {margin: "20px", marginBottom: 0},
});

export function AliasSelector({selectedIdentityId, credView}: Props) {
  const classes = useStyles();
  const {ledger, updateLedger} = useLedger();

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

  const potentialAliases = credView
    .userNodes()
    .map(({address, description}) => ({
      address,
      description,
    }))
    .filter(({address}) => !claimedAddresses.has(address));

  const filteredAliasesMatchingString = (input: string): Alias[] =>
    potentialAliases.filter(({description}) =>
      removeMd(description).toLowerCase().includes(input.toLowerCase())
    );

  const [inputItems, setInputItems] = useState(
    filteredAliasesMatchingString("")
  );

  const setAliasSearch = (input: string = "") =>
    setInputItems(filteredAliasesMatchingString(input));

  useEffect(() => setAliasSearch(), [selectedAccount.identity.aliases]);

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
      <Autocomplete
        onInputChange={(_, value, reason) => {
          if (reason === "input") {
            setAliasSearch(value);
            setInputValue(value);
          }
        }}
        onChange={(_, selectedItem, reason) => {
          if (reason === "select-option") {
            updateLedger(ledger.addAlias(selectedIdentityId, selectedItem));
            setAliasSearch("");
            setInputValue("");
          }
        }}
        className={classes.element}
        freeSolo
        disableClearable
        options={inputItems}
        getOptionLabel={({description}) => description || ""}
        inputValue={inputValue}
        renderInput={(params) => (
          <TextField {...params} variant="outlined" label="Alias" />
        )}
      />
    </>
  );
}
