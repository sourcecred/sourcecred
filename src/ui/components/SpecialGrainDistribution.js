// @flow

import React, {useState} from "react";
import {div, fromInteger, fromFloatString, ZERO} from "../../ledger/grain";
import {type IdentityId} from "../../ledger/identity";
import {type Account} from "../../ledger/ledger";
import AccountDropdown from "./AccountSelector";
import {computeAllocation} from "../../ledger/grainAllocation";
import * as uuid from "../../util/uuid";
import type {TimestampMs} from "../../util/timestamp";
import {useLedger} from "../utils/LedgerContext";

export const SpecialGrainDistribution = () => {
  const {ledger, updateLedger} = useLedger();

  const [credTimestamp, setCredTimestamp] = useState<TimestampMs>(+Date.now());
  const [recipient, setRecipient] = useState<IdentityId | null>(null);
  const [amount, setAmount] = useState<string>("0");
  const [memo, setMemo] = useState<string>("");

  const setRecipientFromAccount = (acct: Account | null) => {
    setRecipient(acct ? acct.identity.id : null);
  };

  const submitDistribution = (e) => {
    e.preventDefault();
    if (recipient != null && amount !== ZERO) {
      const policy = {
        policyType: "SPECIAL",
        budget: fromFloatString(amount),
        memo,
        recipient,
      };
      const allocation = computeAllocation(policy, [
        {cred: [1], paid: ZERO, id: recipient},
      ]);
      const distribution = {
        id: uuid.random(),
        credTimestamp,
        allocations: [allocation],
      };
      const nextLedger = ledger.distributeGrain(distribution);
      updateLedger(nextLedger);
      setAmount(fromInteger(0));
      setRecipient(null);
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
      <h1>Legacy Grain Distribution Tool</h1>
      <p>
        This is a temporary migration tool for making special Grain payments. It
        is intended to port legacy ledger balances.
      </p>
      <form onSubmit={(e) => submitDistribution(e)}>
        <label>Recipient</label>
        <AccountDropdown
          ledger={ledger}
          setCurrentAccount={setRecipientFromAccount}
        />
        <p>
          <label htmlFor="amount">Amount</label> <br />
          <input
            type="number"
            name="amount"
            min="0"
            step="any"
            required
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
          />
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
        <p>
          <label htmlFor="timestamp">Timestamp</label> <br />
          <input
            type="number"
            name="timestamp"
            value={credTimestamp}
            onChange={(e) => {
              const newTimestamp = +e.currentTarget.value;
              if (!Number.isFinite(newTimestamp)) {
                throw new Error(`invalid timestamp: ${e.currentTarget.value}`);
              }
              setCredTimestamp(newTimestamp);
            }}
          />
        </p>
        <input
          disabled={recipient == null}
          type="submit"
          value="distribute special grain"
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
