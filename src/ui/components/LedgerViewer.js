// @flow

import React, {
  memo,
  type Node as ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import Table from "@material-ui/core/Table";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import TableBody from "@material-ui/core/TableBody";
import Dialog from "@material-ui/core/Dialog";
import * as G from "../../core/ledger/grain";
import DialogContent from "@material-ui/core/DialogContent";
import Tooltip from "@material-ui/core/Tooltip";
import Chip from "@material-ui/core/Chip";
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

const useStyles = makeStyles(() => {
  return {
    container: {
      maxHeight: "90vh",
      maxWidth: "60em",
      margin: "0 auto",
    },
    dialog: {
      paddingTop: "0 !important",
      padding: 0,
    },
  };
});

export const LedgerViewer = ({
  currency: {suffix: currencySuffix},
}): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();
  const [allocation, setAllocation] = useState<Allocation | null>(null);

  const handleClickOpen = useCallback((allocation: Distribution) => {
    setAllocation(allocation);
  }, []);

  const handleClose = useCallback(() => {
    setAllocation(null);
  }, []);

  const events = useMemo(() => ledger.eventLog().reverse(), [ledger]);

  return (
    <TableContainer component={Paper} className={classes.container}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Event</TableCell>
            <TableCell>Details</TableCell>
            <TableCell align="right">Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e) => (
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
    allocation: Allocation,
    ledger: Ledger,
    currencySuffix: string,
  }) => {
    return (
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Participant</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allocation
            ? allocation.receipts.sort(comparator).map((r) => {
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
              <Chip label={action.identity.subtype} size="small" />
            </>
          );
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
                onClick={() => handleClickOpen(a)}
                size="small"
              />
            </Box>
          ));

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
          <Box display="flex" flexDirection="row" alignItems="center">
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
