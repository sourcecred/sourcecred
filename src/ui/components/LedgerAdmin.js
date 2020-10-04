// @flow

import React, {useState, type Node as ReactNode} from "react";
import {type Identity, type IdentityId} from "../../core/identity";
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
      margin: `${marginNum}px`,
    },
    centerRow: {
      display: "flex",
      justifyContent: "center",
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
  };
});

export const LedgerAdmin = (): ReactNode => {
  const {ledger, updateLedger} = useLedger();

  const classes = useStyles();
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [selectedId, setSelectedId] = useState<IdentityId | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [checkboxSelected, setCheckBoxSelected] = useState<boolean>(false);

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
    const renderIdentity = (i: Identity, notLastElement: boolean) => (
      <>
        <ListItem button onClick={() => setActiveIdentity(i)} key={i.id}>
          {i.name}
        </ListItem>
        {notLastElement && <Divider />}
      </>
    );
    const numAccounts = ledger.accounts().length;
    return (
      <>
        {ledger
          .accounts()
          .map((a) => a.identity)
          .map((identity, index) =>
            renderIdentity(identity, index < numAccounts - 1)
          )}
      </>
    );
  };

  return (
    <Container className={classes.root}>
      <span className={classes.centerRow}>
        <h1 className={classes.IdentitiesHeader}>Identities</h1>{" "}
        {ledger.accounts().length > 0 && <h3> (click one to update it)</h3>}
      </span>
      <div className={classes.centerRow}>
        <List fullWidth className={classes.identityList}>
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
