// @flow

import React, {type Node as ReactNode} from "react";
import {
  Ledger,
  type AddAlias as AddAliasType,
} from "../../../core/ledger/ledger";
import IdentityDetails from "./IdentityDetails";
import Chip from "@mui/material/Chip";

const AddAlias = ({
  ledger,
  action,
  classes,
}: {
  ledger: Ledger,
  action: AddAliasType,
  classes: Object,
}): ReactNode => {
  try {
    const account = ledger.account(action.identityId);
    let alias = action.alias.description;
    // description has format: channel/[handle](optional url). Parse out channel & handle
    const descriptionParts = alias.match(/^([^/]*)\/\[([^\]]*)\]/);

    if (descriptionParts) {
      const [, channel, handle] = descriptionParts;
      alias = `${channel}/${handle}`;
    }

    return (
      <>
        <IdentityDetails
          id={action.identityId}
          name={`${account.identity.name} ⇐ ${alias}`}
        />
        <Chip
          className={classes.chip}
          label={account.identity.subtype}
          size="small"
        />
      </>
    );
  } catch (e) {
    console.warn("Unable to find account for action: ", action);
    return <IdentityDetails id={action.identityId} name="[Unknown Account]" />;
  }
};

export default AddAlias;
