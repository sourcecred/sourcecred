// @flow

import React, {useState} from "react";
import {
  div,
  format,
  gt,
  fromInteger,
  fromApproximateFloat, // TODO: utilize `fromFloatString`
  type Grain,
} from "../../ledger/grain";
import {type Identity} from "../../ledger/identity";
import {Ledger, type Account} from "../../ledger/ledger";
import AccountDropdown from "./AccountSelector";

export type Props = {|
  +initialLedger: Ledger,
|};

export const TransferGrain = ({initialLedger}: Props) => {
  const [ledger, setLedger] = useState<Ledger>(initialLedger);
  const [sourceIdentity, setSourceIdentity] = useState<Identity | null>(null);
  const [destIdentity, setDestIdentity] = useState<Identity | null>(null);
  const [amount, setAmount] = useState<string>("0");
  const [maxAmount, setMaxAmount] = useState<Grain>(fromInteger(0));
  const [memo, setMemo] = useState<string>("");

  const setSender = (acct: Account) => {
    setMaxAmount(acct.balance);
    setSourceIdentity(acct.identity);
  };

  const setReceiver = (acct: Account) => {
    setDestIdentity(acct.identity);
  };

  const submitTransfer = (e) => {
    e.preventDefault();
    if (sourceIdentity && destIdentity) {
      const nextLedger = ledger.transferGrain({
        from: sourceIdentity.id,
        to: destIdentity.id,
        amount: fromApproximateFloat(parseFloat(amount)),
        memo: memo,
      });
      setLedger(nextLedger);
      setAmount(fromInteger(0));
      setSender(nextLedger.account(sourceIdentity.id));
      setMemo("");
    }
  };

  return (
    <div
      style={{
        width: "80%",
        margin: "0 auto",
        background: "white",
        padding: "0 5em 5em",
      }}
    >
      <h1>Transfer Grain</h1>
      <form onSubmit={(e) => submitTransfer(e)}>
        <label>From</label>
        <AccountDropdown ledger={ledger} setCurrentIdentity={setSender} />
        <br />
        <label>To</label>
        <AccountDropdown ledger={ledger} setCurrentIdentity={setReceiver} />
        <p>
          <label htmlFor="amount">Amount</label> <br />
          <input
            type="number"
            name="amount"
            min="0"
            placeholder={`max: ${maxAmount}`}
            required
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
          />
          <span>{` max: ${format(maxAmount, 5)}`}</span>
        </p>
        <p>
          <label htmlFor="memo">Memo</label> <br />
          <input
            type="text"
            name="memo"
            value={memo}
            onChange={(e) => setMemo(e.currentTarget.value)}
          />
        </p>
        <input
          disabled={
            !Number(amount) ||
            gt(fromApproximateFloat(parseFloat(amount)), maxAmount)
          }
          type="submit"
          value="transfer grain"
        />
        <br />
        <input
          type="button"
          value="save ledger to disk"
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
        />
      </form>
    </div>
  );
};
