// @flow

import React, {useState} from "react";
import {Button, Input} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {
  div,
  format,
  gt,
  fromInteger,
  fromFloatString,
  type Grain,
} from "../../ledger/grain";
import {type Identity} from "../../ledger/identity";
import {Ledger, type Account} from "../../ledger/ledger";
import AccountDropdown from "./AccountSelector";

export type Props = {|
  +ledger: Ledger,
  +setLedger: (Ledger) => void,
|};

const useStyles = makeStyles({
  root: {
    width: "60%",
    margin: "0 auto",
    background: "white",
    padding: "0 5em 5em",
  },
  arrowBody: {
    width: "280px",
    marginLeft: "20px",
    background: "#C9CED2",
    padding: "5px 20px",
  },
  triangle: {
    width: 0,
    height: 0,
    background: "white",
    borderTop: "30px solid transparent",
    borderBottom: "30px solid transparent",
    borderLeft: "30px solid #C9CED2",
  },
  dropdown: {
    width: "300px",
    height: "50px",
    border: "1px solid #9EADBA",
    borderRadius: "500px",
    background: "#F2F5F7",
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  third: {
    width: "300px",
    height: "50px",
    margin: "30px 15px",
  },
  half: {
    width: "450px",
    height: "50px",
    margin: "30px",
  },
  memo: {
    width: "960px",
    height: "50px",
    border: "1px solid #9EADBA",
    paddingLeft: "20px",
    color: "black",
  },
});

export const TransferGrain = ({ledger, setLedger}: Props) => {
  const classes = useStyles();
  const [sourceIdentity, setSourceIdentity] = useState<Identity | null>(null);
  const [destIdentity, setDestIdentity] = useState<Identity | null>(null);
  const [amount, setAmount] = useState<string>("0");
  const [maxAmount, setMaxAmount] = useState<Grain>(fromInteger(0));
  const [memo, setMemo] = useState<string>("");

  const setSender = (acct: Account | null) => {
    setMaxAmount(acct ? acct.balance : fromInteger(0));
    setSourceIdentity(acct ? acct.identity : null);
  };

  const setReceiver = (acct: Account | null) => {
    setDestIdentity(acct ? acct.identity : null);
  };

  const submitTransfer = (e) => {
    e.preventDefault();
    if (sourceIdentity && destIdentity) {
      const nextLedger = ledger.transferGrain({
        from: sourceIdentity.id,
        to: destIdentity.id,
        amount: fromFloatString(amount),
        memo: memo,
      });
      setLedger(nextLedger);
      setAmount(fromInteger(0));
      setSender(nextLedger.account(sourceIdentity.id));
      setMemo("");
    }
  };

  return (
    <form onSubmit={(e) => submitTransfer(e)}>
      <div className={classes.root}>
        <div className={classes.centerRow}>
          <h1>Transfer Grain</h1>
        </div>
        <div className={classes.centerRow}>
          <div
            className={`${classes.dropdown} ${classes.centerRow} ${classes.third}`}
          >
            <AccountDropdown
              ledger={ledger}
              setCurrentIdentity={setSender}
              placeholder="From..."
              disableUnderline
            />
          </div>
          <div className={`${classes.centerRow} ${classes.third}`}>
            <div className={classes.arrowBody}>
              <Input
                disableUnderline
                type="number"
                name="amount"
                min="0"
                step="any"
                placeholder="(amount)"
                value={amount !== "0" ? amount : ""}
                onChange={(e) => setAmount(e.currentTarget.value)}
              />
              <span>{sourceIdentity && ` max: ${format(maxAmount, 2)}`}</span>
            </div>
            <div className={classes.triangle} />
          </div>
          <div
            className={`${classes.dropdown} ${classes.centerRow} ${classes.third}`}
          >
            <AccountDropdown
              ledger={ledger}
              setCurrentIdentity={setReceiver}
              placeholder="To..."
              disableUnderline
            />
          </div>
        </div>
        <div className={classes.centerRow}>
          <Input
            className={classes.memo}
            disableUnderline
            type="text"
            name="memo"
            value={memo}
            placeholder="Memo"
            onChange={(e) => setMemo(e.currentTarget.value)}
          />
        </div>
        <div className={classes.centerRow}>
          <Button
            className={`${classes.centerRow} ${classes.half}`}
            style={{background: "#6558F5"}}
            variant="contained"
            disabled={
              !Number(amount) ||
              !(sourceIdentity && destIdentity) ||
              gt(fromFloatString(amount), maxAmount)
            }
          >
            transfer grain
          </Button>
          <Button
            className={`${classes.centerRow} ${classes.half}`}
            style={{background: "#C9CED2"}}
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
        </div>
      </div>
    </form>
  );
};
