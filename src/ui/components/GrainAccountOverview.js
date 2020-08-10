// @flow

import React from "react";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {type Account, Ledger} from "../../ledger/ledger";
import {CredView} from "../../analysis/credView";
import * as G from "../../ledger/grain";
export type Props = {|
  +ledger: Ledger,
  +credView: CredView,
|};

export const GrainAccountOverview = (props: Props) => {
  const accounts = props.ledger.accounts();

  function comparator(a: Account, b: Account) {
    if (a.balance === b.balance) {
      return 0;
    }
    return G.gt(a.paid, b.paid) ? -1 : 1;
  }

  const sortedAccounts = accounts.slice().sort(comparator);
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell align="right">Active?</TableCell>
            <TableCell align="right">Current Balance</TableCell>
            <TableCell align="right">Grain Earned</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{sortedAccounts.map((a) => AccountRow(a))}</TableBody>
      </Table>
    </TableContainer>
  );
};

const AccountRow = (account: Account) => (
  <TableRow key={account.identity.id}>
    <TableCell component="th" scope="row">
      {account.identity.name}
    </TableCell>
    <TableCell align="right">{account.active ? "✅" : "🛑"}</TableCell>
    <TableCell align="right">{G.format(account.balance)}</TableCell>
    <TableCell align="right">{G.format(account.paid)}</TableCell>
  </TableRow>
);
