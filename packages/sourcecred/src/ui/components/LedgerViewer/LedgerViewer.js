// @flow

import React, {
  type Node as ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import deepFreeze from "deep-freeze";
import Table from "@material-ui/core/Table";
import Typography from "@material-ui/core/Typography";
import TablePagination from "@material-ui/core/TablePagination";
import TableBody from "@material-ui/core/TableBody";
import Dialog from "@material-ui/core/Dialog";
import Toolbar from "@material-ui/core/Toolbar";
import DialogContent from "@material-ui/core/DialogContent";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {
  KeyboardDatePicker,
} from '@material-ui/pickers';
import {type LedgerEvent} from "../../../core/ledger/ledger";
import {useLedger} from "../../utils/LedgerContext";
import {makeStyles} from "@material-ui/core/styles";
import type {Allocation} from "../../../core/ledger/grainAllocation";
import type {CurrencyDetails} from "../../../api/currencyConfig";
import {
  useTableState,
  SortOrders,
  DEFAULT_SORT,
} from "../../../webutil/tableState";
import LedgerEventRow from "./LedgerEventRow";
import GrainReceiptTable from "./GrainReceiptTable";
import Grid from "@material-ui/core/Grid";

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
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    chip: {
      fontSize: "0.55rem",
      color: "#828282",
      backgroundColor: "#383838",
      textShadow: "0 1px 0 rgba(0,0,0, 0.4)",
    },
  };
});

const DATE_SORT = deepFreeze({
  name: Symbol("Date"),
  fn: (e: LedgerEvent) => e.ledgerTimestamp,
});

const PAGINATION_OPTIONS = deepFreeze([25, 50, 100]);

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

  const handleStartDateChange = (date) => {
    setStartDateFilter(date);
  }
  const handleEndDateChange = (date) => {
    setEndDateFilter(date);
  }


  const eventLog = useMemo(() => [...ledger.eventLog()], [ledger]);
  const  [startDateFilter, setStartDateFilter] = useState(new Date());
  const  [endDateFilter, setEndDateFilter] = useState(new Date());

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

  return (
    <Paper className={classes.container}>
      <Toolbar className={classes.toolbar}>
        <Typography variant="h6" id="tableTitle" component="div">
          Ledger Event History
        </Typography>
      <Grid 
        container
        justifyContent="space-between">
        <KeyboardDatePicker
          disableToolbar
          variant="inline"
          format="MM/dd/yyyy"
          margin="normal"
          id="date-picker-inline"
          label="Start Date"
          value={startDateFilter}
          onChange={handleStartDateChange}
          KeyboardButtonProps={{
            'aria-label': 'change start date',
          }}
        />
        <KeyboardDatePicker
          margin="normal"
          id="date-picker-dialog"
          label="End Date"
          format="MM/dd/yyyy"
          value={endDateFilter}
          onChange={handleEndDateChange}
          KeyboardButtonProps={{
            'aria-label': 'change end date',
          }}
        />
        </Grid>
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
