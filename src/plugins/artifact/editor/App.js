// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

type Props = {};
type State = {};

export default class App extends React.Component<Props, State> {
  render() {
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Artifact editor</h1>
        </header>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#f0f",
  },
});
