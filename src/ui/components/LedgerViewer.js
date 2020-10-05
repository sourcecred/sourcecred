// @flow

import React, {type Node as ReactNode, useMemo} from "react";
import Table from "@material-ui/core/Table";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import TableBody from "@material-ui/core/TableBody";
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

const useStyles = makeStyles(() => {
  return {
    container: {
      maxHeight: "90vh",
      maxWidth: "60em",
      margin: "0 auto",
    },
  };
});

export const LedgerViewer = (): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();

  const events = useMemo(() => ledger.eventLog(), [ledger]);

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
            <LedgerEventRow key={e.uuid} event={e} ledger={ledger} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const LedgerEventRow = React.memo(
  ({event, ledger}: {event: LedgerEvent, ledger: Ledger}) => {
    return (
      <TableRow>
        <TableCell component="th" scope="row">
          <Typography variant="button">
            {event.action.type.replace("_", " ")}
          </Typography>
        </TableCell>
        <TableCell>
          <Box display="flex" flexDirection="row" alignItems="center">
            {getEventDetails(event, ledger)}
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

const getEventDetails = ({action}: LedgerEvent, ledger: Ledger): ReactNode => {
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
          <IdentityDetails id={action.identityId} name="[Unknown Account]" />
        );
      }

    default:
      return "";
  }
};
