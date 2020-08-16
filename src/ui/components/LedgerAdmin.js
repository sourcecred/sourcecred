// @flow
import React, {useState, useEffect} from "react";
import {Autocomplete} from "@material-ui/lab";
import {type Identity, type IdentityId} from "../../ledger/identity";
import {Ledger} from "../../ledger/ledger";
import {AliasView} from "./AliasView";
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

export type Props = {|
  +ledger: Ledger,
  +setLedger: (Ledger) => void,
|};

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

export const LedgerAdmin = ({ledger, setLedger}: Props) => {
  console.log("render LedgerAdmin");
  const classes = useStyles();
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [checkboxSelected, setCheckBoxSelected] = useState<boolean>(false);

  const changeIdentityName = (event: SyntheticInputEvent<HTMLInputElement>) =>
    setIdentityName(event.currentTarget.value);

  const createOrUpdateIdentity = () => {
    if (!currentIdentity) {
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      const {id} = currentIdentity;
      ledger.renameIdentity(id, nextIdentityName);
      setIdentityName("");
      setCurrentIdentity(null);
    }
    setLedger(ledger);
  };

  const toggleIdentityActivation = ({id}: Identity) => {
    if (ledger.account(id).active) {
      ledger.deactivate(id);
      setCheckBoxSelected(false);
    } else {
      ledger.activate(id);
      setCheckBoxSelected(true);
    }
    setLedger(ledger);
  };

  const resetIdentity = () => {
    setIdentityName("");
    setCurrentIdentity(null);
    setCheckBoxSelected(false);
    setPromptString("Add Identity: ");
  };

  const setActiveIdentity = (identity: Identity) => {
    setIdentityName(identity.name);
    setCurrentIdentity(identity);
    setCheckBoxSelected(ledger.account(identity.id).active);
    setPromptString("Update Identity: ");
  };

  const renderIdentities = () => {
    const renderIdentity = (i: Identity, notLastElement: boolean) => (
      <React.Fragment key={i.id}>
        <ListItem button onClick={() => setActiveIdentity(i)}>
          {i.name}
        </ListItem>
        {notLastElement && <Divider />}
      </React.Fragment>
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
        <List className={classes.identityList}>{renderIdentities()}</List>
      </div>
      <h3 className={classes.promptStringHeader}>{promptString}</h3>
      <div className={classes.centerRow}>
        <TextField
          className={classes.updateElement}
          variant="outlined"
          type="text"
          onChange={changeIdentityName}
          value={nextIdentityName}
          label={"Name"}
        />
        {currentIdentity && (
          <FormControlLabel
            className={classes.checkboxElement}
            control={
              <Checkbox
                checked={checkboxSelected}
                onChange={() => toggleIdentityActivation(currentIdentity)}
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
          {currentIdentity ? "update username" : "create identity"}
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
        {currentIdentity && (
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
      {currentIdentity && (
        <>
          <AliasView selectedIdentityId={currentIdentity.id} ledger={ledger} />
          <IdentityMerger
            selectedIdentityId={currentIdentity.id}
            ledger={ledger}
            setLedger={setLedger}
          />
        </>
      )}
    </Container>
  );
};

type IdentityProps = {|
  +selectedIdentityId: IdentityId,
  +ledger: Ledger,
  +setLedger: (Ledger) => void,
|};

const identityUseStyles = makeStyles({
  element: {margin: "20px"},
  aliasesHeader: {margin: "20px", marginBottom: 0},
});

export function IdentityMerger({
  selectedIdentityId,
  ledger,
  setLedger,
}: IdentityProps) {
  const classes = identityUseStyles();
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

  useEffect(() => setSearch(), [selectedIdentityId]);

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
            console.log("setLedger in IdentityMerger");
            const newLedger = ledger.mergeIdentities({
              base: selectedIdentityId,
              target: selectedItem.id,
            });
            setLedger(newLedger);
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
