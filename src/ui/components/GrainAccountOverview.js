// @flow

import React from "react";
import {Ledger, type Account} from "../../ledger/ledger";
import {CredView} from "../../analysis/credView";
import * as G from "../../ledger/grain";

export type Props = {|
  +ledger: Ledger,
  +credView: CredView,
|};

export class GrainAccountOverview extends React.Component<Props> {
  render() {
    const accounts = this.props.ledger.accounts();
    function comparator(a: Account, b: Account) {
      if (a.balance === b.balance) {
        return 0;
      }
      return G.gt(a.balance, b.balance) ? -1 : 1;
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

function AccountRow(account: Account) {
  return (
    <tr key={account.identity.id}>
      <td>{account.identity.name}</td>
      <td>{account.active ? "✅" : "🛑"}</td>
      <td>{G.format(account.balance)}</td>
      <td>{G.format(account.paid)}</td>
    </tr>
  );
}
