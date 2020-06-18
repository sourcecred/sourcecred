// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {StyleSheet, css} from "aphrodite/no-important";

export default class HomePage extends React.Component<{|+assets: Assets|}> {
  render() {
    return (
      <div className={css(styles.container)}>
        <h1>Under Construction</h1>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 900,
    margin: "0 auto",
    marginBottom: 200,
    padding: "0 10px",
    lineHeight: 1.5,
    fontSize: 20,
  },
});
