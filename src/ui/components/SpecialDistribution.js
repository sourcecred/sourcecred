// @flow
import React, {useState} from "react";
import {Button, Container, TextField} from "@material-ui/core";
import {Alert} from "@material-ui/lab";
import {makeStyles} from "@material-ui/core/styles";
import {div, fromFloatString, lt, ZERO} from "../../ledger/grain";
import {type Account} from "../../ledger/ledger";
import AccountDropdown from "./AccountSelector";
import {computeAllocation} from "../../ledger/grainAllocation";
import * as uuid from "../../util/uuid";
import type {TimestampMs} from "../../util/timestamp";
import {useLedger} from "../utils/LedgerContext";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "80%",
    minWidth: "1100px",
    margin: "0 auto",
    padding: "0 5em 5em",
  },
  arrowBody: {
    color: theme.palette.text.primary,
    flex: 1,
    background: theme.palette.background.paper,
    padding: "5px 20px",
    display: "flex",
    alignItems: "center",
  },
  triangle: {
    width: 0,
    height: 0,
    background: theme.palette.background,
    borderTop: "30px solid transparent",
    borderBottom: "30px solid transparent",
    borderLeft: `30px solid ${theme.palette.background.paper}`,
  },
  dropdownWrapper: {
    border: "1px solid #9EADBA",
    borderRadius: "50px",
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  element: {flex: 1, margin: "20px"},
  arrowInput: {width: "40%", display: "inline-block"},
  headerText: {color: theme.palette.text.primary},
}));

export const SpecialDistribution = () => {
  const {ledger, updateLedger} = useLedger();

  const classes = useStyles();
  const [credTimestamp, setCredTimestamp] = useState<TimestampMs>(+Date.now());
  const [recipient, setRecipient] = useState<Account | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const submitDistribution = () => {
    if (recipient && amount && amount !== ZERO) {
      const policy = {
        policyType: "SPECIAL",
        budget: fromFloatString(amount),
        memo,
        recipient: recipient.identity.id,
      };
      const allocation = computeAllocation(policy, [
        {cred: [1], paid: ZERO, id: recipient.identity.id},
      ]);
      const distribution = {
        id: uuid.random(),
        credTimestamp,
        allocations: [allocation],
      };
      const nextLedger = ledger.distributeGrain(distribution);
      updateLedger(nextLedger);
      setSuccessMessage(
        `You transfered ${amount} grain to ${recipient.identity.name}!`
      );
      setAmount("");
      setMemo("");
      setRecipient(null);
    }
  };

  const postLedger = () =>
    fetch("data/ledger.json", {
      headers: {
        Accept: "text/plain",
        "Content-Type": "text/plain",
      },
      method: "POST",
      body: ledger.serialize(),
    });

  return (
    <Container className={classes.root}>
      <h1 className={`${classes.centerRow} ${classes.headerText}`}>
        Legacy Grain Distribution Tool
      </h1>
      <p className={`${classes.centerRow} ${classes.headerText}`}>
        This is a temporary migration tool for making special Grain payments. It
        is intended to port legacy ledger balances.
      </p>
      {successMessage && (
        <div className={classes.centerRow}>
          <Alert severity="success" className={classes.element}>
            {successMessage}
          </Alert>
        </div>
      )}
      <div className={classes.centerRow}>
        <div className={`${classes.centerRow} ${classes.element}`}>
          <div className={classes.arrowBody}>
            <TextField
              className={classes.arrowInput}
              size="medium"
              InputProps={{disableUnderline: true}}
              type="number"
              placeholder="(amount)"
              value={amount}
              onChange={(e) => setAmount(e.currentTarget.value)}
            />
          </div>
          <div className={classes.triangle} />
        </div>
        <div
          className={`${classes.dropdownWrapper} ${classes.centerRow} ${classes.element}`}
        >
          <AccountDropdown
            ledger={ledger}
            setCurrentAccount={setRecipient}
            placeholder="Recipient"
          />
        </div>
      </div>
      <div className={classes.centerRow}>
        <TextField
          variant="outlined"
          size="medium"
          className={classes.element}
          type="text"
          value={memo}
          placeholder="Memo"
          onChange={(e) => setMemo(e.currentTarget.value)}
        />
        <TextField
          variant="outlined"
          size="medium"
          className={classes.element}
          type="number"
          value={credTimestamp}
          placeholder="Timestamp"
          onChange={(e) => {
            const newTimestamp = +e.currentTarget.value;
            if (!Number.isFinite(newTimestamp)) {
              throw new Error(`invalid timestamp: ${e.currentTarget.value}`);
            }
            setCredTimestamp(newTimestamp);
          }}
        />
      </div>
      <div className={classes.centerRow}>
        <Button
          size="large"
          color="primary"
          variant="contained"
          className={classes.element}
          disabled={
            !Number(amount) ||
            !recipient ||
            lt(fromFloatString(amount), fromFloatString("0"))
          }
          onClick={submitDistribution}
        >
          distribute special grain
        </Button>
        <Button
          size="large"
          color="primary"
          variant="contained"
          className={classes.element}
          onClick={postLedger}
        >
          save ledger to disk
        </Button>
      </div>
    </Container>
  );
};
