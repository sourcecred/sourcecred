// @flow

import React from "react";
import {type Identity} from "../ledger/identity";
import {Ledger} from "../ledger/ledger";

export type Props = {||};

export type State = {|
  +ledger: Ledger,
  nextIdentityName: string,
|};

export class LedgerAdmin extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    console.log("construct");
    this.state = {ledger: new Ledger(), nextIdentityName: ""};
  }

  // TODO: fix any
  changeIdentityName(event: any) {
    this.setState({nextIdentityName: event.target.value});
  }

  createIdentity(event: any) {
    event.preventDefault();
    this.state.ledger.createIdentity("USER", this.state.nextIdentityName);
    this.setState({ledger: this.state.ledger, nextIdentityName: ""});
  }

  render() {
    return (
      <div>
        <h1>Identities:</h1>
        {this.renderIdentities()}
        <h1>Add Identity:</h1>
        <form onSubmit={(e) => this.createIdentity(e)}>
          <label>
            Name:
            <input
              type="text"
              value={this.state.nextIdentityName}
              onChange={(e) => this.changeIdentityName(e)}
            />
          </label>
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }

  renderIdentities() {
    function renderIdentity(i: Identity) {
      return <div key={i.id}>{i.name}</div>;
    }
    return <div>{this.state.ledger.identities().map(renderIdentity)}</div>;
  }
}
