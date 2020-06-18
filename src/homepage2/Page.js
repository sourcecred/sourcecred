// @flow

import React, {type Node} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import type {Assets} from "../webutil/assets";
import type {RouteData} from "./routeData";
import {VERSION_SHORT, VERSION_FULL} from "../core/version";

export default class Page extends React.Component<{|
  +assets: Assets,
  +routeData: RouteData,
  +children: Node,
|}> {
  render() {
    return (
      <React.Fragment>
        <div className={css(style.nonFooter)}>
          <main>{this.props.children}</main>
        </div>
        <footer className={css(style.footer)}>
          <div className={css(style.footerWrapper)}>
            <span className={css(style.footerText)}>
              ({VERSION_FULL}) <strong>{VERSION_SHORT}</strong>
            </span>
          </div>
        </footer>
      </React.Fragment>
    );
  }
}

const footerHeight = 30;
const style = StyleSheet.create({
  footer: {
    color: "#666",
    height: footerHeight,
    fontSize: 14,
    position: "relative",
  },
  footerWrapper: {
    textAlign: "right",
    position: "absolute",
    bottom: 5,
    width: "100%",
  },
  footerText: {
    marginRight: 5,
  },
  nonFooter: {
    minHeight: `calc(100vh - ${footerHeight}px)`,
  },
});
