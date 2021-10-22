// @flow

import React, {
  useState,
  useMemo,
  type Node as ReactNode,
  useCallback,
} from "react";
import {makeStyles} from "@material-ui/core/styles";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  List,
  TextField,
  ListSubheader,
  Divider,
  debounce,
} from "@material-ui/core";

import {useLedger} from "../utils/LedgerContext";
import {useTableState} from "../../webutil/tableState";
import {IdentityMerger} from "./IdentityMerger";
import {type Identity, type IdentityId} from "../../core/identity";
import {PayableAddressView} from "./PayableAddressView";
import {AliasView} from "./AliasView";
import {IdentityListItems} from "./IdentityListItems";
import {type CurrencyDetails} from "../../api/currencyConfig";
import {getCurrencyKey} from "../../core/ledger/currency";
import {
  type EthAddress,
  ethAddressParser,
  parseAddress,
} from "../../plugins/ethereum/ethAddress.js";

const useStyles = makeStyles((theme) => {
  return {
    root: {
      color: theme.palette.text.primary,
      width: "100%",
      maxWidth: "50em",
      padding: "0 5em 5em",
    },
    identityList: {
      backgroundColor: theme.palette.background.paper,
      width: "100%",
      marginTop: theme.spacing(3),
      overflow: "auto",
      maxHeight: 500,
    },
    centerRow: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    spreadRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      margin: theme.spacing(6, 0, 0, 0),
    },
    updateElement: {
      flexGrow: 2,
      flexBasis: theme.spacing(5),
      margin: theme.spacing(3, 0),
    },
    filterBox: {
      flexGrow: 1,
      maxWidth: "15rem",
    },
    checkboxElement: {flexGrow: 1, flexBasis: 0, margin: theme.spacing(3)},
    IdentitiesHeader: {margin: theme.spacing(3, 0)},
    backButton: {
      marginLeft: theme.spacing(2),
    },
    addEditPrompt: {
      margin: 0,
    },
    listSubheader: {
      display: "grid",
      gridTemplateColumns: "auto auto",
      justifyContent: "space-between",
    },
  };
});

type Props = {|
  +currency: CurrencyDetails,
|};

export const LedgerAdmin = ({currency}: Props): ReactNode => {
  const {ledger, updateLedger, saveToDisk} = useLedger();
  const {integrationCurrency} = currency;

  const classes = useStyles();
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [selectedId, setSelectedId] = useState<IdentityId | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [nextPayoutAddress, setPayoutAddress] = useState<string>("");
  const accounts = useMemo(() => Array.from(ledger.accounts()), [ledger]);
  const accountsTableState = useTableState({data: accounts});

  const changeIdentityName = (event: SyntheticInputEvent<HTMLInputElement>) =>
    setIdentityName(event.currentTarget.value);

  const nullifyUnsetPayoutAddress = (): EthAddress | null =>
    nextPayoutAddress ? parseAddress(nextPayoutAddress) : null;

  function addNextPayoutAddressToLedger(
    selectedId: IdentityId,
    integrationCurrency
  ) {
    if (integrationCurrency.type === "EVM") {
      const {chainId, tokenAddress} = integrationCurrency;
      ledger.setPayoutAddress(
        selectedId,
        nullifyUnsetPayoutAddress(),
        chainId,
        tokenAddress
      );
    } else {
      const {chainId} = integrationCurrency;
      ledger.setPayoutAddress(selectedId, nullifyUnsetPayoutAddress(), chainId);
    }
  }

  function modifyExistingIdentity(id: IdentityId) {
    // don't write an unchanged name to the ledger
    if (ledger.account(id).identity.name !== nextIdentityName)
      ledger.renameIdentity(id, nextIdentityName);
    if (
      // don't update the payout address if no integration currency is
      // configured
      integrationCurrency &&
      // don't write an unchanged payout address to the ledger
      getPayoutAddress(id) !== nextPayoutAddress
    ) {
      addNextPayoutAddressToLedger(id, integrationCurrency);
    }
  }
  const createOrUpdateIdentity = () => {
    // If no ID is selected, create a new identity
    if (!selectedId) {
      // create the new identity with the entered name
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      // Otherwise, an identity is selected, Update it according to the
      // changes made to Component state.
      modifyExistingIdentity(selectedId);
    }
    updateLedger(ledger);
  };

  const toggleIdentityActivation = useCallback(
    (id: IdentityId) => {
      let nextLedger;
      if (ledger.account(id).active) {
        nextLedger = ledger.deactivate(id);
      } else {
        nextLedger = ledger.activate(id);
      }
      updateLedger(nextLedger);
    },
    [ledger]
  );

  const getPayoutAddress = (identityId: IdentityId) => {
    if (!currency.integrationCurrency) {
      return "";
    }
    const key = getCurrencyKey(currency.integrationCurrency);
    const currentPayableAddress = ledger
      .account(identityId)
      ?.payoutAddresses.get(key);

    return currentPayableAddress ?? "";
  };

  const resetIdentity = () => {
    setIdentityName("");
    setSelectedId(null);
    setPromptString("Add Identity: ");
  };

  const setActiveIdentity = useCallback((identity: Identity) => {
    setIdentityName(identity.name);
    const payoutAddress = getPayoutAddress(identity.id);
    setPayoutAddress(payoutAddress);
    setSelectedId(identity.id);
    setPromptString("Update Identity: ");
  }, []);

  const filterIdentities = (event: SyntheticInputEvent<HTMLInputElement>) => {
    // fuzzy match letters "in order, but not necessarily sequentially", per issue #2490
    const filterString = event.target.value
      .trim()
      .toLowerCase()
      .split("")
      .join("+.*");
    searchAccounts(filterString);
  };

  const searchAccounts = useCallback(
    debounce((filterString) => {
      const regex = new RegExp(filterString);
      accountsTableState.createOrUpdateFilterFn("filterIdentities", (account) =>
        regex.test(account.identity.name.toLowerCase())
      );
    }, 400),
    []
  );

  const payableAddressIsInvalid = useMemo(() => {
    if (!currency.integrationCurrency) return false;
    if (nextPayoutAddress === "") return false;
    return !ethAddressParser.parse(nextPayoutAddress).ok;
  }, [nextPayoutAddress]);

  const nameIsEmpty = useMemo(() => nextIdentityName.trim().length === 0, [
    nextIdentityName,
  ]);

  const formIsInvalid = payableAddressIsInvalid || nameIsEmpty;

  return (
    <Container className={classes.root}>
      <span className={classes.centerRow}>
        <h1 className={classes.IdentitiesHeader}>Identities</h1>
      </span>
      <h3 className={classes.addEditPrompt}>{promptString}</h3>
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
                onChange={() => toggleIdentityActivation(selectedId)}
                checked={ledger.account(selectedId)?.active}
                name="active"
                color="primary"
              />
            }
            label="Account is active"
          />
        )}
      </div>
      {selectedId && currency.integrationCurrency && (
        <div className={classes.updateElement}>
          <PayableAddressView
            nextPayoutAddress={nextPayoutAddress}
            setPayoutAddress={setPayoutAddress}
            error={payableAddressIsInvalid}
          />
        </div>
      )}

      <ButtonGroup color="primary" variant="contained">
        <Button onClick={createOrUpdateIdentity} disabled={formIsInvalid}>
          {selectedId
            ? `update name${currency.integrationCurrency ? " and address" : ""}`
            : "create identity"}
        </Button>
        <Button onClick={saveToDisk}>save ledger to disk</Button>
        {selectedId && <Button onClick={resetIdentity}>New identity</Button>}
      </ButtonGroup>
      {selectedId && (
        <Button onClick={resetIdentity} className={classes.backButton}>
          Back
        </Button>
      )}
      {selectedId && (
        <>
          <AliasView selectedId={selectedId} />
          <IdentityMerger selectedId={selectedId} />
        </>
      )}
      <div className={classes.spreadRow}>
        <h3>
          Identities
          {accountsTableState.length > 0 && (
            <small> (click one to update it)</small>
          )}
        </h3>
        <TextField
          className={classes.filterBox}
          variant="outlined"
          type="text"
          onChange={filterIdentities}
          label={"Filter list..."}
        />
      </div>
      <div className={classes.centerRow}>
        <List
          fullWidth
          subheader={
            <ListSubheader>
              <div className={classes.listSubheader}>
                <div>Participant</div>
                <div>Active</div>
              </div>
            </ListSubheader>
          }
          className={classes.identityList}
        >
          <Divider />
          <IdentityListItems
            accounts={accountsTableState.currentPage}
            onClick={setActiveIdentity}
            onCheckbox={toggleIdentityActivation}
          />
        </List>
      </div>
    </Container>
  );
};
