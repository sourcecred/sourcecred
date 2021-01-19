// @flow

import React, {type Node as ReactNode} from "react";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {type Account} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../../api/currencyConfig";
import * as G from "../../core/ledger/grain";
import {useLedger} from "../utils/LedgerContext";
import findLast from "lodash.findlast";
import {formatTimestamp} from "../utils/dateHelpers";
import {makeStyles} from "@material-ui/core/styles";

type OverviewProps = {|+currency: CurrencyDetails|};

const useStyles = makeStyles(() => {
  return {
    container: {
      maxHeight: "80vh",
    },
  };
});

export const AccountOverview = ({
  currency: {name: currencyName, suffix: currencySuffix},
}: OverviewProps): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();

  const accounts = ledger.accounts();
  const lastPayoutEvent = findLast(
    ledger.eventLog(),
    (event) => event.action.type === "DISTRIBUTE_GRAIN"
  );
  const lastPayoutMessage = lastPayoutEvent
    ? `Last distribution: ${formatTimestamp(lastPayoutEvent.ledgerTimestamp)}`
    : "";

  function comparator(a: Account, b: Account) {
    if (a.balance === b.balance) {
      return 0;
    }
    return G.gt(a.paid, b.paid) ? -1 : 1;
  }

  const sortedAccounts = accounts.slice().sort(comparator);
  return (
    <>
      <TableContainer component={Paper} className={classes.container}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell align="right">Active?</TableCell>
              <TableCell align="right">Current Balance</TableCell>
              <TableCell align="right">{`${currencyName}`} Earned</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAccounts.map((a) => AccountRow(a, currencySuffix))}
          </TableBody>
        </Table>
      </TableContainer>
      <p align="right">{lastPayoutMessage}</p>
    </>
  );
};

const AccountRow = (account: Account, suffix: string) => (
  <TableRow key={account.identity.id}>
    <TableCell component="th" scope="row">
      {account.identity.name}
    </TableCell>
    <TableCell align="right">{account.active ? "✅" : "🛑"}</TableCell>
    <TableCell align="right">{G.format(account.balance, 2, suffix)}</TableCell>
    <TableCell align="right">{G.format(account.paid, 2, suffix)}</TableCell>
  </TableRow>
);
