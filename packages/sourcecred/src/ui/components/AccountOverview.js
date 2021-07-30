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
import {formatTimestamp} from "../utils/dateHelpers";
import {makeStyles} from "@material-ui/core/styles";
import IdentityDetails from "./LedgerViewer/IdentityDetails";

type OverviewProps = {|+currency: CurrencyDetails|};

const useStyles = makeStyles(() => {
  return {
    container: {
      maxHeight: "80vh",
    },
  };
});

export const AccountOverview = ({
  currency: {
    name: currencyName,
    suffix: currencySuffix,
    decimals: decimalsToDisplay,
  },
}: OverviewProps): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();

  const lastDistributionTimestamp = ledger.lastDistributionTimestamp();
  const lastPayoutMessage =
    lastDistributionTimestamp === null
      ? ""
      : `Last distribution: ${formatTimestamp(lastDistributionTimestamp)}`;

  const accounts = ledger.accounts();
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
            {sortedAccounts.map((a) =>
              AccountRow(a, currencySuffix, decimalsToDisplay)
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <p align="right">{lastPayoutMessage}</p>
    </>
  );
};

const AccountRow = (account: Account, suffix: string, decimals: number) => (
  <TableRow key={account.identity.id}>
    <TableCell component="th" scope="row">
      <IdentityDetails id={account.identity.id} name={account.identity.name} />
    </TableCell>
    <TableCell align="right">{account.active ? "✅" : "🛑"}</TableCell>
    <TableCell align="right">
      {G.format(account.balance, decimals, suffix)}
    </TableCell>
    <TableCell align="right">
      {G.format(account.paid, decimals, suffix)}
    </TableCell>
  </TableRow>
);
