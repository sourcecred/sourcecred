// @flow
import React, {Component} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import {Header} from "./Header";

type AppProps = {||};
type AppState = {||};

type Entity = {|
  +name: string,
  +score: number,
|};

const exampleValues: $ReadOnlyArray<Entity> = [
  {name: "Implementation", score: 1002},
  {name: "Research", score: 1001},
  {name: "Ethics", score: 1000},
  {name: "Learning", score: 999},
  {name: "Something With A Long Name, Really Quite Long", score: 999},
  {name: "@1", score: 998},
  {name: "@2", score: 998},
  {name: "@3", score: 998},
  {name: "@4", score: 998},
  {name: "@5", score: 998},
  {name: "@6", score: 998},
];

const examplePeople: $ReadOnlyArray<Entity> = [
  {name: "@decentralion", score: 1002},
  {name: "@wchargin", score: 1001},
  {name: "@mzargham", score: 1000},
  {name: "@brianlitwin", score: 999},
  {name: "@anthrocypher", score: 998},
  {name: "@brutalfluffy", score: 998},
  {name: "@1", score: 998},
  {name: "@2", score: 998},
  {name: "@3", score: 998},
  {name: "@4", score: 998},
  {name: "@5", score: 998},
  {name: "@6", score: 998},
  {name: "@7", score: 998},
  {name: "@8", score: 998},
  {name: "@9", score: 998},
];

class App extends Component<AppProps, AppState> {
  scoreList(title: string, entities: $ReadOnlyArray<Entity>) {
    const entries = entities.map(({name, score}) => (
      <div key={name} className={css(styles.entityRow)}>
        <div className={css(styles.entityName)}>{name}</div>
        <div className={css(styles.entityScore)}>{score.toFixed(0)} ¤</div>
      </div>
    ));
    return (
      <div className={css(styles.scoreList)}>
        <h1 className={css(styles.scoreListTitle)}>{title}</h1>
        {entries}
      </div>
    );
  }

  render() {
    return (
      <div className={css(styles.app)}>
        <Header />

        <div className={css(styles.nonHeader)}>
          <div className={css(styles.scoreListsContainer)}>
            {this.scoreList("Our Values", exampleValues)}
            {this.scoreList("Our People", examplePeople)}
          </div>

          <div className={css(styles.chartContainer)}>Chart to go here.</div>
        </div>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  app: {
    // HACK: Position absolute / top:0 to cover up the header from the
    // default SourceCred UI. There's some discussion in the pull request:
    // https://github.com/sourcecred/sourcecred/pull/1132
    top: "0px",
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
  },

  scoreList: {
    padding: "20px 20px 50px 20px",
  },

  scoreListTitle: {
    fontSize: "28px",
    lineHeight: "36px",
    color: "#fff",
    fontFamily: "'DINCondensed', sans-serif",
    fontWeight: "700",
    letterSpacing: "0.04em",
    margin: "0 0 20px 0",
  },

  entityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "16px",
    lineHeight: "19px",
    marginTop: "20px",
    cursor: "pointer",
  },

  entityName: {
    fontWeight: "700",
    color: "#E9EDEC",
    letterSpacing: "-0.2px",
  },

  entityScore: {
    color: "#EDAD47",
    fontWeight: "600",
    flexShrink: 0,
    paddingLeft: "5px",
  },

  scoreListsContainer: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#242424",
    "overflow-y": "scroll",
    minWidth: "400px",
  },

  nonHeader: {
    display: "flex",
    flexDirection: "row",
    paddingTop: "80px",
    overflow: "hidden",
  },

  chartContainer: {
    width: "100%",
    padding: "42px",
    display: "flex",
  },
});

export default App;
