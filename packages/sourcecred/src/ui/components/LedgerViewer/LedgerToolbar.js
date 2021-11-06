// @flow

import React, {type Node as ReactNode, useState, useEffect} from "react";
import {type Action, type LedgerEvent} from "../../../core/ledger/ledger";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import InputLabel from "@material-ui/core/InputLabel";
// Maybe use react-select instead?
// https://medium.com/geekculture/creating-multi-select-dropdown-with-checkbox-in-react-792ff2464ef3
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import {type TableState} from "../../../webutil/tableState";

// alternative to hardcoding?
// You could instantiate a Set (sets don't have duplicates),
// loop through the Ledger events and add their action types to the Set
// and then make an array out of the set.
const ACTION_TYPES = [
  "CREATE_IDENTITY",
  "RENAME_IDENTITY",
  "CHANGE_IDENTITY_TYPE",
  "ADD_ALIAS",
  "MERGE_IDENTITIES",
  "TOGGLE_ACTIVATION",
  "DISTRIBUTE_GRAIN",
  "TRANSFER_GRAIN",
  "SET_PAYOUT_ADDRESS",
];

type LedgerToolbarProps = {|
  +classes: Object,
  +ts: TableState<LedgerEvent>,
|};

const LedgerToolbar = (props: LedgerToolbarProps): ReactNode => {
  const [filter, setFilter] = useState<Array<string>>([]);

  const handleFilterChange = (event) => {
    filter.push(event.target.value);
    setFilter(filter);
    props.ts.createOrUpdateFilterFn("filterEventName", (ledgerEvent) =>
      filter.includes(ledgerEvent.action.type)
    );
  };

  const handleDeleteFilter = (type) => {
    filter.splice(filter.indexOf(type), 1);
    setFilter(filter);
    if (filter.length) {
      props.ts.createOrUpdateFilterFn("filterEventName", (ledgerEvent) =>
        filter.includes(ledgerEvent.action.type)
      );
    } else {
      props.ts.createOrUpdateFilterFn("filterEventName", null);
    }
  };

  // filter : seperate component?
  // filter Chips - array of selected filters??
  return (
    <Toolbar className={props.classes.toolbar}>
      <Typography variant="h6" id="tableTitle" component="div">
        Ledger Event History
      </Typography>
      <InputLabel>Select Ledger Action</InputLabel>
      <Select onChange={handleFilterChange}>{filterOptions()}</Select>
      {filter.map((type) => (
        <Chip
          variant="outlined"
          key={type}
          label={type}
          onDelete={() => handleDeleteFilter(type)}
        />
      ))}
    </Toolbar>
  );
};

const filterOptions = () => {
  let filterOptions = [];
  ACTION_TYPES.forEach((action) => {
    filterOptions.push(<MenuItem value={action}>{action}</MenuItem>);
  });
  return filterOptions;
};

export default LedgerToolbar;
