// @flow

import React, {type Node as ReactNode, useState, useEffect} from "react";
import {type Action, type LedgerEvent} from "../../../core/ledger/ledger";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Chip from '@material-ui/core/Chip';
import {type TableState} from "../../../webutil/tableState";

// alternative to hardcoding?
const ACTION_TYPES = ["CREATE_IDENTITY", "RENAME_IDENTITY", "CHANGE_IDENTITY_TYPE", "ADD_ALIAS", "MERGE_IDENTITIES", "TOGGLE_ACTIVATION", "DISTRIBUTE_GRAIN", "TRANSFER_GRAIN", "SET_PAYOUT_ADDRESS"];

type LedgerToolbarProps = {|
  +classes: Object,
  +ts: TableState<LedgerEvent>
|};

const LedgerToolbar = (props: LedgerToolbarProps): ReactNode => {
  const [filter, setFilter] = useState<string>("");

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
    props.ts.createOrUpdateFilterFn(
      "filterEventName",
      (ledgerEvent) => ledgerEvent.action.type
        .includes(event.target.value)
    )
  };

  const handleDeleteFilter = (event) => {
    setFilter("");
    props.ts.createOrUpdateFilterFn(
      "filterEventName",
      null
    )
  };

  // filter : seperate component?
  // filter Chips - array of selected filters?? 
  return (
    <Toolbar className={props.classes.toolbar}>
      <Typography variant="h6" id="tableTitle" component="div">
        Ledger Event History
      </Typography>
      <InputLabel>Select Ledger Action</InputLabel>
      <Select onChange={handleFilterChange}>
        {filterOptions()}
      </Select>
      {filter && <Chip variant="outlined" label={filter} onDelete={handleDeleteFilter}/>}
    </Toolbar>
  );
}

const filterOptions = () => {
  let filterOptions = [];
  ACTION_TYPES.forEach((action) => {
    filterOptions.push(
      <MenuItem value={action}>{action}</MenuItem>
    );
  });
  return filterOptions;
}

export default LedgerToolbar;