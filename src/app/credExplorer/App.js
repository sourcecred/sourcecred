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
          <h1>Cred Explorer</h1>
        </header>
        <p>Welcome to the SourceCred Explorer!</p>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#f0f",
  },
});
