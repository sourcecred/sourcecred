// @flow

import React, {useState} from "react";
import {type Identity, type IdentityId} from "../../ledger/identity";
import {AliasView} from "./AliasView";
import {IdentityMerger} from "./IdentityMerger";
import {makeStyles} from "@material-ui/core/styles";
import {
  Button,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  TextField,
} from "@material-ui/core";
import {useLedger} from "../utils/LedgerContext";
import {useAutocomplete} from "@material-ui/lab";

const useStyles = makeStyles((theme) => {
  const marginNum = 20;
  const flexBasis = marginNum * 2;
  return {
    root: {
      color: theme.palette.text.primary,
      width: "80%",
      margin: "0 auto",
      padding: "0 5em 5em",
    },
    identityList: {
      backgroundColor: theme.palette.background.paper,
      width: "100%",
      height: "20em",
      margin: `${marginNum}px`,
    },
    centerRow: {
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
    },
    element: {flex: 1, margin: `${marginNum}px`},
    updateElement: {
      flexGrow: 2,
      flexBasis: `${flexBasis}px`,
      margin: `${marginNum}px`,
    },
    checkboxElement: {flexGrow: 1, flexBasis: 0, margin: `${marginNum}px`},
    promptStringHeader: {margin: `${marginNum}px`, marginBottom: 0},
    IdentitiesHeader: {margin: `${marginNum}px`},
    input: {
      margin: `${marginNum}px`,
    },
  };
});

export const LedgerAdmin = () => {
  const {ledger, updateLedger} = useLedger();

  const classes = useStyles();
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [selectedId, setSelectedId] = useState<IdentityId | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [checkboxSelected, setCheckBoxSelected] = useState<boolean>(false);

  const {
    getInputProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
    inputValue,
  } = useAutocomplete({
    id: "autocomplete-accounts",
    options: ledger.accounts(),
    getOptionLabel: ({identity}) => identity.name,
  });

  const changeIdentityName = (event: SyntheticInputEvent<HTMLInputElement>) =>
    setIdentityName(event.currentTarget.value);

  const createOrUpdateIdentity = () => {
    if (!selectedId) {
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      ledger.renameIdentity(selectedId, nextIdentityName);
    }
    updateLedger(ledger);
  };
  const toggleIdentityActivation = (id: IdentityId) => {
    let nextLedger;
    if (ledger.account(id).active) {
      nextLedger = ledger.deactivate(id);
      setCheckBoxSelected(false);
    } else {
      nextLedger = ledger.activate(id);
      setCheckBoxSelected(true);
    }
    updateLedger(nextLedger);
  };

  const resetIdentity = () => {
    setIdentityName("");
    setSelectedId(null);
    setCheckBoxSelected(false);
    setPromptString("Add Identity: ");
  };

  const setActiveIdentity = (identity: Identity) => {
    setIdentityName(identity.name);
    setSelectedId(identity.id);
    setCheckBoxSelected(ledger.account(identity.id).active);
    setPromptString("Update Identity: ");
  };

  const renderIdentities = () => {
    const renderIdentity = (
      i: Identity,
      index: number,
      notLastElement: boolean
    ) => (
      <>
        <ListItem
          {...getOptionProps({i, index})}
          button
          onClick={() => setActiveIdentity(i)}
          key={i.id}
        >
          {i.name}
        </ListItem>
        {notLastElement && <Divider />}
      </>
    );
    const numAccounts = ledger.accounts().length;
    const accounts = inputValue ? groupedOptions : ledger.accounts();
    return (
      <>
        {accounts.length > 0 ? (
          accounts
            .map((a) => a.identity)
            .sort(function (a, b) {
              return a.name.localeCompare(b.name);
            })
            .map((identity, index) =>
              renderIdentity(identity, index, index < numAccounts - 1)
            )
        ) : (
          <ListItem>{"No Identities are here"}</ListItem>
        )}
      </>
    );
  };
  return (
    <Container className={classes.root}>
      <span className={classes.centerRow}>
        <h1 className={classes.IdentitiesHeader}>Identities</h1>
        <TextField
          className={classes.input}
          label="Search"
          handleHomeEndKeys
          selectOnFocus
          clearOnBlur
          {...getInputProps()}
          variant="outlined"
        />
      </span>
      <div className={classes.centerRow}>
        <List {...getListboxProps} fullWidth className={classes.identityList}>
          {renderIdentities()}
        </List>
      </div>
      <h3 className={classes.promptStringHeader}>{promptString}</h3>
      <div className={classes.centerRow}>
        <TextField
          fullWidth
          className={classes.updateElement}
          variant="outlined"
          type="text"
          onChange={changeIdentityName}
          value={nextIdentityName}
          label={"Name"}
        />
        {selectedId && (
          <FormControlLabel
            fullWidth
            className={classes.checkboxElement}
            control={
              <Checkbox
                checked={checkboxSelected}
                onChange={() => toggleIdentityActivation(selectedId)}
                name="active"
                color="primary"
              />
            }
            label="Account is active"
          />
        )}
      </div>
      <div className={classes.centerRow}>
        <Button
          className={classes.element}
          size="large"
          color="primary"
          variant="contained"
          onClick={createOrUpdateIdentity}
        >
          {selectedId ? "update username" : "create identity"}
        </Button>
        <Button
          className={classes.element}
          size="large"
          color="primary"
          variant="contained"
          onClick={() => {
            fetch("data/ledger.json", {
              headers: {
                Accept: "text/plain",
                "Content-Type": "text/plain",
              },
              method: "POST",
              body: ledger.serialize(),
            });
          }}
        >
          save ledger to disk
        </Button>
        {selectedId && (
          <Button
            className={classes.element}
            size="large"
            color="primary"
            variant="contained"
            onClick={resetIdentity}
          >
            New identity
          </Button>
        )}
      </div>
      {selectedId && (
        <>
          <AliasView selectedId={selectedId} />
          <IdentityMerger selectedId={selectedId} />
        </>
      )}
    </Container>
  );
};
