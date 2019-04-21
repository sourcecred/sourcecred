// @flow
import React, {Component} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import LogoIcon from "./img/logo.svg";

export type Props = {||};
export class Header extends Component<Props> {
  render() {
    return (
      <div className={css(styles.header)}>
        <div className={css(styles.titleBlock)}>
          <div className={css(styles.projectName)}>Project Name Here</div>
          <div className={css(styles.logo)}>
            <span>SourceCred</span>
            <LogoIcon />
          </div>
        </div>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    position: "fixed",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    top: "0",
    left: "0",
    height: "80px",
    width: "100%",
    backgroundColor: "#1D1D1C",
    padding: "0 50px",
    zIndex: "776",
  },

  titleBlock: {
    minWidth: "380px",
    color: "#E9EDEC",
    fontSize: "32px",
    lineHeight: "30px",
    fontFamily: "'DINCondensed', sans-serif",
    fontWeight: "700",
  },

  logo: {
    display: "flex",
    alignItems: "center",
    fontSize: "20px",
    lineHeight: "20px",
    color: "#8E8F91",
    letterSpacing: "-0.25px",

    span: {
      height: "16px",
    },

    svg: {
      width: "20px",
      height: "20px",
      marginLeft: "7px",
    },
  },
});
