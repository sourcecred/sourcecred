// @flow

import React, {type Node} from "react";

export default class Page extends React.Component<{|+children: Node|}> {
  render() {
    return (
      <div>
        <main>{this.props.children}</main>
      </div>
    );
  }
}
