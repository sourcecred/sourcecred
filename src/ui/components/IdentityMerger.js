// @flow
import React, {useState, useEffect, type Node as ReactNode} from "react";
import {useLedger} from "../utils/LedgerContext";
import {type IdentityId, type Identity} from "../../core/identity";

import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import {Autocomplete} from "@material-ui/lab";

type Props = {|
  +selectedId: IdentityId,
|};

export function IdentityMerger({selectedId}: Props): ReactNode {
  const {ledger, updateLedger} = useLedger();
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState<?IdentityId>();

  const potentialIdentities = ledger
    .accounts()
    .map((a) => a.identity)
    .filter((i) => i.id !== selectedId);

  const identitiesMatchingSearch = (input: string): Identity[] =>
    potentialIdentities.filter(({name}) =>
      name.toLowerCase().includes(input.toLowerCase())
    );

  const [inputItems, setInputItems] = useState(identitiesMatchingSearch(""));

  const setSearch = (input: string = "") =>
    setInputItems(identitiesMatchingSearch(input));

  useEffect(() => {
    setSearch();
  }, [selectedId]);

  useEffect(() => {
    // This effect just defers the ledger update until after
    // the render that shows some loading state
    // This is a bit of a hack because we haven't full async'd ledger changes yet
    // but it definitely improves UI responsiveness, especially for larger communities
    if (targetId) {
      updateLedger(
        ledger.mergeIdentities({
          base: selectedId,
          target: targetId,
        })
      );
      setTargetId();
      setLoading(false);
    }
  }, [targetId]);

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
            setLoading(true);
            setTargetId(selectedItem.id);
            setSearch("");
            setInputValue("");
          }
        }}
        freeSolo
        disableClearable
        options={inputItems}
        getOptionLabel={({name}) => name || ""}
        inputValue={inputValue}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label="Add Alias"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress disableShrink color="inherit" size={20} />
                  ) : null}
                </>
              ),
            }}
          />
        )}
      />
    </>
  );
}
