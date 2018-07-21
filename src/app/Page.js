// @flow

import React, {type Node} from "react";
import {Link} from "react-router";

import {routeData} from "./routeData";
import * as NullUtil from "../util/null";

export default class Page extends React.Component<{|+children: Node|}> {
  render() {
    return (
      <div>
        <header>
          <nav>
            <ul style={{listStyle: "none", paddingLeft: 0, margin: 0}}>
              {routeData.map(({navTitle, path}) =>
                NullUtil.map(navTitle, (navTitle) => (
                  <li key={path} style={{display: "inline", marginRight: 10}}>
                    <Link to={path}>{navTitle}</Link>
                  </li>
                ))
              )}
            </ul>
          </nav>
        </header>
        <main>{this.props.children}</main>
      </div>
    );
  }
}
