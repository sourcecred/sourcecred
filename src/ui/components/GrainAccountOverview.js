// @flow

import React from "react";
import {type CredAccount, computeCredAccounts} from "../../ledger/credAccounts";
import {Ledger} from "../../ledger/ledger";
import {CredView} from "../../analysis/credView";
import * as G from "../../ledger/grain";

export type Props = {|
  +ledger: Ledger,
  +credView: CredView,
|};

export class GrainAccountOverview extends React.Component<Props> {
  render() {
    const {accounts} = computeCredAccounts(
      this.props.ledger,
      this.props.credView
    );
    function comparator(a: CredAccount, b: CredAccount) {
      if (a.account.balance === b.account.balance) {
        return 0;
      }
      return G.gt(a.account.balance, b.account.balance) ? -1 : 1;
    }
    const sortedAccounts = accounts.slice().sort(comparator);
    return (
      <div>
        <table
          style={{
            width: "100%",
            marginLeft: "80px",
            marginRight: "80px",
            tableLayout: "fixed",
            margin: "0 auto",
            padding: "20px 10px",
            color: "white",
          }}
        >
          <thead>
            <tr style={{fontSize: "1.4em"}}>
              <th style={{textAlign: "left"}}>Username</th>
              <th style={{textAlign: "left"}}>Active?</th>
              <th style={{textAlign: "left"}}>Current Balance</th>
              <th style={{textAlign: "left"}}>Grain Earned</th>
            </tr>
          </thead>
          <tbody>{sortedAccounts.map((a) => AccountRow(a))}</tbody>
        </table>
      </div>
    );
  }
}

function AccountRow({account}: CredAccount) {
  return (
    <tr>
      <td>{account.identity.name}</td>
      <td>{account.active ? "✅" : "🛑"}</td>
      <td>{G.format(account.balance)}</td>
      <td>{G.format(account.paid)}</td>
    </tr>
  );
}
