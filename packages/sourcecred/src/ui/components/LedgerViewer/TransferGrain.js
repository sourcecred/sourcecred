// @flow

import React, {type Node as ReactNode} from "react";
import {
  Ledger,
  type TransferGrain as TransferGrainType,
} from "../../../core/ledger/ledger";
import IdentityDetails from "./IdentityDetails";
import Chip from "@material-ui/core/Chip";
import * as G from "../../../core/ledger/grain";

const TransferGrain = ({
  ledger,
  action,
  classes,
}: {
  ledger: Ledger,
  action: TransferGrainType,
  classes: Object,
}): ReactNode => {
  let sender;
  let recipient;
  const amount = G.formatAndTrim(action.amount);
  try {
    const senderAccount = ledger.account(action.from);
    sender = (
      <>
        <IdentityDetails
          id={senderAccount.identity.id}
          name={senderAccount.identity.name}
        />
        <Chip
          className={classes.chip}
          label={senderAccount.identity.subtype}
          size="small"
        />
      </>
    );
  } catch (e) {
    console.warn("Unable to find account for sender in action: ", action);
    sender = <IdentityDetails id={action.from} name="[Unknown Account]" />;
  }

  try {
    const recipientAccount = ledger.account(action.to);
    recipient = (
      <>
        <IdentityDetails
          id={recipientAccount.identity.id}
          name={recipientAccount.identity.name}
        />
        <Chip
          className={classes.chip}
          label={recipientAccount.identity.subtype}
          size="small"
        />
      </>
    );
  } catch (e) {
    console.warn("Unable to find account for recipient in action: ", action);
    recipient = <IdentityDetails id={action.to} name="[Unknown Account]" />;
  }

  return (
    <>
      {sender}
      &nbsp; &rArr; &nbsp;
      {amount}
      &nbsp; &rArr; &nbsp;
      {recipient}
    </>
  );
};

export default TransferGrain;
