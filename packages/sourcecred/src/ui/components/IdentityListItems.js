// @flow
import React, {type Node as ReactNode, useMemo} from "react";
import {Divider, ListItem, ListItemText, Checkbox} from "@material-ui/core";
import {type Identity, type IdentityId} from "../../core/identity";
import {type Account} from "../../core/ledger/ledger";

type IdentityListItemsProps = {
  +accounts: $ReadOnlyArray<Account>,
  +onClick: (Identity) => void,
  +onCheckbox: (IdentityId) => void,
};

export const IdentityListItems = ({
  accounts,
  onClick,
  onCheckbox,
}: IdentityListItemsProps): ReactNode => {
  const lastIndex = accounts.length - 1;
  return useMemo(() => {
    if (lastIndex > -1) {
      return accounts.map((account, index) => (
        <React.Fragment key={account.identity.id}>
          <ListItem button onClick={() => onClick(account.identity)}>
            <ListItemText primary={account.identity.name} />
            <Checkbox
              onClick={(e) => e.stopPropagation()}
              onChange={() => onCheckbox(account.identity.id)}
              checked={account.active}
              name="active"
              color="primary"
            />
          </ListItem>
          {index < lastIndex && <Divider />}
        </React.Fragment>
      ));
    } else {
      return (
        <ListItem button key="no_results">
          <em>No results</em>
        </ListItem>
      );
    }
  }, [accounts]);
};
