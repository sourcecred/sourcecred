// @flow
import React, {type Node as ReactNode} from "react";
import {Divider, ListItem} from "@material-ui/core";
import {type Identity} from "../../core/identity";

type IdentityListItemsProps = {
  +identities: $ReadOnlyArray<Identity>,
  +onClick: Function,
};

export const IdentityListItems = ({
  identities,
  onClick,
}: IdentityListItemsProps): ReactNode => {
  const lastIndex = identities.length - 1;

  if (lastIndex > -1) {
    return identities.map((identity, index) => (
      <React.Fragment key={identity.id}>
        <ListItem button onClick={() => onClick(identity)}>
          {identity.name}
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
};
