// @flow

import React, {
  type Node as ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import deepFreeze from "deep-freeze";
import Checkbox from "@material-ui/core/Checkbox";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import FormControl from "@material-ui/core/FormControl";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import ListItemText from "@material-ui/core/ListItemText";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import Typography from "@material-ui/core/Typography";
import TablePagination from "@material-ui/core/TablePagination";
import TableBody from "@material-ui/core/TableBody";
import Dialog from "@material-ui/core/Dialog";
import Toolbar from "@material-ui/core/Toolbar";
import DialogContent from "@material-ui/core/DialogContent";
import Select from "@material-ui/core/Select";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {type LedgerEvent} from "../../../core/ledger/ledger";
import {useLedger} from "../../utils/LedgerContext";
import {makeStyles, withStyles} from "@material-ui/core/styles";
import type {Allocation} from "../../../core/ledger/grainAllocation";
import type {CurrencyDetails} from "../../../api/currencyConfig";
import {
  useTableState,
  SortOrders,
  DEFAULT_SORT,
} from "../../../webutil/tableState";
import LedgerEventRow from "./LedgerEventRow";
import GrainReceiptTable from "./GrainReceiptTable";

const useStyles = makeStyles((theme) => {
  return {
    container: {
      width: "100%",
    },
    table: {
      maxHeight: "75vh",
    },
    dialog: {
      paddingTop: "0 !important",
      padding: 0,
    },
    toolbar: {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(1),
    },
    formControl: {
      margin: theme.spacing(1),
      minWidth: 120,
      "& .MuiInput-underline:after": {
        borderBottomColor: "rgba(215, 226, 243, 0.7)",
      },
      "& .MuiInput-underline:after": {
        borderBottomColor: "rgba(215, 226, 243, 0.7)",
      },
      [`& .MuiInput-underline.Mui-focused:before,
        & .MuiInput-underline.Mui-focused:after`]: {
        borderBottomColor: "#31AAEE",
      },
      "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
        borderBottomColor: "rgb(215, 226, 243)",
      },
      "& .MuiSelect-icon": {
        fill: "rgba(215, 226, 243, 0.7)",
        "&.MuiSelect-iconOpen": {
          fill: "#31AAEE",
        },
      },
      "& .Mui-focused .MuiSelect-icon": {
        fill: "#31AAEE",
      },
    },
    filterLabel: {
      color: "rgba(215, 226, 243, 0.7)",
      "&.Mui-focused": {
        color: "#31AAEE",
      },
    },
    chip: {
      fontSize: "0.55rem",
      color: "#828282",
      backgroundColor: "#383838",
      textShadow: "0 1px 0 rgba(0,0,0, 0.4)",
    },
  };
});

const FilterCheckbox = withStyles({
  root: {
    color: "#CBDFFF",
    "&$checked": {
      color: "#CBDFFF",
    },
  },
  checked: {},
})((props) => <Checkbox color="default" {...props} />);

const DATE_SORT = deepFreeze({
  name: Symbol("Date"),
  fn: (e: LedgerEvent) => e.ledgerTimestamp,
});

const PAGINATION_OPTIONS = deepFreeze([25, 50, 100]);

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const FilterMenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 7.5 + ITEM_PADDING_TOP,
      width: 250,
      transform: "translateY(51px)",
    },
  },
};

// todo update to actual events
const eventNames = [
  "Create Identity",
  "Rename Identity",
  "Add Alias",
  "Merge Identities",
  "Toggle Activation",
  "Distribute Grain",
  "Transfer Grain",
  "Change Identity Type",
  "Set Payout Address",
  "Enable Grain Integration",
  "Disable Grain Integration",
  "Mark Distribution Executed",
];

export const LedgerViewer = ({
  currency: {suffix: currencySuffix, decimals: decimalsToDisplay},
}: {
  currency: CurrencyDetails,
}): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();
  const [allocation, setAllocation] = useState<Allocation | null>(null);

  const handleClickOpen = useCallback((allocation: Allocation) => {
    setAllocation(allocation);
  }, []);

  const handleClose = useCallback(() => {
    setAllocation(null);
  }, []);

  const eventLog = useMemo(() => [...ledger.eventLog()], [ledger]);
  const ts = useTableState(
    {data: eventLog},
    {
      initialRowsPerPage: PAGINATION_OPTIONS[0],
      initialSort: {
        sortName: DATE_SORT.name,
        sortOrder: SortOrders.DESC,
        sortFn: DATE_SORT.fn,
      },
    }
  );

  const [filterEvents, setFilterEvents] = React.useState([]);

  const handleEventFilterChange = (event) => {
    setFilterEvents(event.target.value);
  };

  return (
    <Paper className={classes.container}>
      <Toolbar className={classes.toolbar}>
        <Typography variant="h6" id="tableTitle" component="div">
          Ledger Event History
        </Typography>
      </Toolbar>
      {/* todo break out into own component */}
      <Toolbar className={classes.toolbar}>
        <FormControl className={classes.formControl}>
          <InputLabel id="event-filter-label" className={classes.filterLabel}>
            Filter Events
          </InputLabel>
          <Select
            multiple
            labelId="event-filter-label"
            onChange={handleEventFilterChange}
            value={filterEvents}
            input={<Input />}
            renderValue={(selected) => selected.join(", ")}
            MenuProps={FilterMenuProps}
            IconComponent={KeyboardArrowDownIcon}
          >
            {eventNames.map((name) => (
              <MenuItem
                key={name}
                value={name}
                className={classes.filterSelectItem}
              >
                <FilterCheckbox
                  checked={filterEvents.indexOf(name) > -1}
                  color="secondary"
                />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Toolbar>
      <TableContainer className={classes.table}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Event</TableCell>
              <TableCell>Details</TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={ts.sortName === DATE_SORT.name}
                  direction={
                    ts.sortName === DATE_SORT.name ? ts.sortOrder : DEFAULT_SORT
                  }
                  onClick={() => ts.setSortFn(DATE_SORT.name, DATE_SORT.fn)}
                >
                  {DATE_SORT.name.description}
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ts.currentPage.map((e) => (
              <LedgerEventRow
                key={e.uuid}
                event={e}
                ledger={ledger}
                currencySuffix={currencySuffix}
                handleClickOpen={handleClickOpen}
              />
            ))}
          </TableBody>
        </Table>
        <Dialog open={!!allocation} onClose={handleClose} scroll="paper">
          <DialogContent className={classes.dialog}>
            <GrainReceiptTable
              allocation={allocation}
              ledger={ledger}
              currencySuffix={currencySuffix}
              decimalsToDisplay={decimalsToDisplay}
            />
          </DialogContent>
        </Dialog>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={PAGINATION_OPTIONS}
        component="div"
        count={ts.length}
        labelRowsPerPage="Rows"
        rowsPerPage={ts.rowsPerPage}
        page={ts.pageIndex}
        onChangePage={(event, newPage) => ts.setPageIndex(newPage)}
        onChangeRowsPerPage={(event) => ts.setRowsPerPage(event.target.value)}
      />
    </Paper>
  );
};
