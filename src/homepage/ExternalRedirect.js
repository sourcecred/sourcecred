// @flow

import React from "react";

import Link from "../webutil/Link";

export default class ExternalRedirect extends React.Component<{|
  +redirectTo: string,
|}> {
  render() {
    return (
      <div style={{maxWidth: 900, margin: "0 auto"}}>
        <h1>Redirecting…</h1>
        <p>
          Redirecting to:{" "}
          <Link href={this.props.redirectTo}>{this.props.redirectTo}</Link>
        </p>
      </div>
    );
  }

  componentDidMount() {
    // The server-rendered copy of this page will have a meta-refresh
    // tag, but someone could still plausibly navigate to this page with
    // the client-side renderer. In that case, we should redirect them.
    window.location.href = this.props.redirectTo;
  }
}
