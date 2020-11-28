// @flow

import React, {
  memo,
  type Node as ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import deepFreeze from "deep-freeze";
import Table from "@material-ui/core/Table";
import Typography from "@material-ui/core/Typography";
import TablePagination from "@material-ui/core/TablePagination";
import Box from "@material-ui/core/Box";
import TableBody from "@material-ui/core/TableBody";
import VisibilityIcon from "@material-ui/icons/Visibility";
import Dialog from "@material-ui/core/Dialog";
import Toolbar from "@material-ui/core/Toolbar";
import DialogContent from "@material-ui/core/DialogContent";
import Tooltip from "@material-ui/core/Tooltip";
import Chip from "@material-ui/core/Chip";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {Ledger, type LedgerEvent} from "../../core/ledger/ledger";
import {useLedger} from "../utils/LedgerContext";
import {makeStyles} from "@material-ui/core/styles";
import {formatTimestamp} from "../utils/dateHelpers";
import type {IdentityId} from "../../core/identity/identity";
import type {Allocation, GrainReceipt} from "../../core/ledger/grainAllocation";
import type {CurrencyDetails} from "../../api/currencyConfig";
import {
  useTableState,
  SortOrders,
  DEFAULT_SORT,
} from "../../webutil/tableState";
import * as G from "../../core/ledger/grain";

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
  currency: {suffix: currencySuffix},
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
  const ts = useTableState(eventLog, {
    initialRowsPerPage: PAGINATION_OPTIONS[0],
    initialSort: {
      sortName: DATE_SORT.name,
      sortOrder: SortOrders.DESC,
      sortFn: DATE_SORT.fn,
    },
  });

  return (
    <Paper className={classes.container}>
      <Toolbar className={classes.toolbar}>
        <Typography variant="h6" id="tableTitle" component="div">
          Ledger Event History
        </Typography>
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

function comparator(a: GrainReceipt, b: GrainReceipt) {
  if (a.amount === b.amount) {
    return 0;
  }
  return G.gt(a.amount, b.amount) ? -1 : 1;
}

const GrainReceiptTable = memo(
  ({
    allocation,
    ledger,
    currencySuffix,
  }: {
    allocation: Allocation | null,
    ledger: Ledger,
    currencySuffix: string,
  }) => {
    if (!allocation) return null;
    return (
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Participant</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allocation
            ? [...allocation.receipts].sort(comparator).map((r) => {
                const account = ledger.account(r.id);

                return (
                  <TableRow key={r.id}>
                    <TableCell component="th" scope="row">
                      <IdentityDetails
                        id={account.identity.id}
                        name={account.identity.name}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {G.format(r.amount, 4, currencySuffix)}
                    </TableCell>
                  </TableRow>
                );
              })
            : null}
        </TableBody>
      </Table>
    );
  }
);

GrainReceiptTable.displayName = "GrainReceiptTable";

const LedgerEventRow = React.memo(
  ({
    event,
    ledger,
    currencySuffix,
    handleClickOpen,
  }: {
    event: LedgerEvent,
    ledger: Ledger,
    currencySuffix: string,
    handleClickOpen: (a: Allocation) => void,
  }) => {
    const classes = useStyles();
    const {action} = event;
    const getEventDetails = () => {
      switch (action.type) {
        case "CREATE_IDENTITY":
          return (
            <>
              <IdentityDetails
                id={action.identity.id}
                name={action.identity.name}
              />
              <Chip
                className={classes.chip}
                label={action.identity.subtype}
                size="small"
              />
            </>
          );
        case "ADD_ALIAS":
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
            return (
              <IdentityDetails
                id={action.identityId}
                name="[Unknown Account]"
              />
            );
          }
        case "TOGGLE_ACTIVATION":
          try {
            const account = ledger.account(action.identityId);
            return (
              <IdentityDetails
                id={account.identity.id}
                name={account.identity.name}
              />
            );
          } catch (e) {
            console.warn("Unable to find account for action: ", action);
            return (
              <IdentityDetails
                id={action.identityId}
                name="[Unknown Account]"
              />
            );
          }
        case "DISTRIBUTE_GRAIN":
          return action.distribution.allocations.map((a, i) => (
            <Box mr={2} key={`${a.policy.policyType}-${i}`}>
              <Chip
                label={`${a.policy.policyType}: ${G.format(
                  a.policy.budget,
                  0,
                  currencySuffix
                )}`}
                clickable
                onClick={() => handleClickOpen(a)}
                onDelete={() => handleClickOpen(a)}
                size="small"
                deleteIcon={<VisibilityIcon />}
              />
            </Box>
          ));
        case "TRANSFER_GRAIN":
          //   amount: "3454650000000000000000"
          // from: "brHJbQhd4Mg80tjbtQ1TNA"
          // memo: "https://etherscan.io/tx/0x710ba7aa963e677373f1c72819964dd94fb9337ca6048100c66087455292e2bc"
          // to: "Ec60d6PWymrN0ylmsZOHkg"
          // type: "TRANSFER_GRAIN"
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
            console.warn(
              "Unable to find account for sender in action: ",
              action
            );
            sender = (
              <IdentityDetails id={action.from} name="[Unknown Account]" />
            );
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
            console.warn(
              "Unable to find account for recipient in action: ",
              action
            );
            recipient = (
              <IdentityDetails id={action.to} name="[Unknown Account]" />
            );
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

        default:
          return "";
      }
    };

    return (
      <TableRow>
        <TableCell component="th" scope="row">
          <Typography variant="button">
            {event.action.type.replace("_", " ")}
          </Typography>
        </TableCell>
        <TableCell>
          <Box
            display="flex"
            flex={1}
            flexDirection="row"
            alignItems="center"
            flexWrap="wrap"
          >
            {getEventDetails()}
          </Box>
        </TableCell>
        <TableCell align="right">
          {formatTimestamp(event.ledgerTimestamp)}
        </TableCell>
      </TableRow>
    );
  }
);

LedgerEventRow.displayName = "LedgerEventRow";

const IdentityDetails = ({
  id,
  name,
}: {
  id: IdentityId,
  name: string,
}): ReactNode => {
  return (
    <Tooltip title={`ID: ${id}`} interactive placement="left">
      <Box mr={1}>{`${name}`}</Box>
    </Tooltip>
  );
};
