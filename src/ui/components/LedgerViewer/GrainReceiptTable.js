// @flow
import React, {type Node as ReactNode} from "react";
import type {
  Allocation,
  GrainReceipt,
} from "../../../core/ledger/grainAllocation";
import {Ledger} from "../../../core/ledger/ledger";
import * as G from "../../../core/ledger/grain";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableBody from "@material-ui/core/TableBody";
import IdentityDetails from "./IdentityDetails";

type GrainReceiptTableProps = {|
  +allocation: Allocation | null,
  +ledger: Ledger,
  +currencySuffix: string,
  +decimalsToDisplay: number,
|};

type GrainTable = (GrainReceiptTableProps) => ReactNode;

const GrainReceiptTable = (props: GrainReceiptTableProps) => {
  if (!props.allocation) return null;
  return (
    <Table stickyHeader size="small">
      <TableHead>
        <TableRow>
          <TableCell>Participant</TableCell>
          <TableCell align="right">Amount</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.allocation
          ? [...props.allocation.receipts].sort(comparator).map((r) => {
              const account = props.ledger.account(r.id);

              return (
                <TableRow key={r.id}>
                  <TableCell component="th" scope="row">
                    <IdentityDetails
                      id={account.identity.id}
                      name={account.identity.name}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {G.format(r.amount, props.decimalsToDisplay, props.currencySuffix)}
                  </TableCell>
                </TableRow>
              );
            })
          : null}
      </TableBody>
    </Table>
  );
};

function comparator(a: GrainReceipt, b: GrainReceipt) {
  if (a.amount === b.amount) {
    return 0;
  }
  return G.gt(a.amount, b.amount) ? -1 : 1;
}

export default ((React.memo(GrainReceiptTable): any): GrainTable);
