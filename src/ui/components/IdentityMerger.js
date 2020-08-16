// @flow
import React, {useState, useEffect} from "react";
import {Ledger} from "../../ledger/ledger";
import {type IdentityId, type Identity} from "../../ledger/identity";
import {type NodeAddressT} from "../../core/graph";

import {makeStyles} from "@material-ui/core/styles";
import {List, ListItem, TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";

type Props = {|
  +selectedIdentityId: IdentityId,
  +ledger: Ledger,
  +setLedger: (Ledger) => void,
|};

const useStyles = makeStyles({
  element: {margin: "20px"},
  aliasesHeader: {margin: "20px", marginBottom: 0},
});

export function IdentityMerger({selectedIdentityId, ledger, setLedger}: Props) {
  const classes = useStyles();
  const selectedAccount = ledger.account(selectedIdentityId);
  if (selectedAccount == null) {
    throw new Error("Selected identity not present in ledger");
  }
  const [inputValue, setInputValue] = useState("");

  const potentialIdentities = ledger
    .accounts()
    .map((a) => a.identity)
    .filter((i) => i.id !== selectedIdentityId);

  const identitiesMatchingSearch = (input: string): Identity[] =>
    potentialIdentities.filter(({name}) =>
      name.toLowerCase().includes(input.toLowerCase())
    );

  const [inputItems, setInputItems] = useState(identitiesMatchingSearch(""));

  const setSearch = (input: string = "") =>
    setInputItems(identitiesMatchingSearch(input));

  useEffect(() => setSearch(), [selectedAccount.identity.aliases]);

  return (
    <>
      <Autocomplete
        onInputChange={(_, value, reason) => {
          if (reason === "input") {
            setSearch(value);
            setInputValue(value);
          }
        }}
        onChange={(_, selectedItem, reason) => {
          if (reason === "select-option") {
            setLedger(
              ledger.mergeIdentities({
                base: selectedIdentityId,
                target: selectedItem.id,
              })
            );
            setSearch("");
            setInputValue("");
          }
        }}
        className={classes.element}
        freeSolo
        disableClearable
        options={inputItems}
        getOptionLabel={({name}) => name || ""}
        inputValue={inputValue}
        renderInput={(params) => (
          <TextField {...params} variant="outlined" label="Identity" />
        )}
      />
    </>
  );
}
