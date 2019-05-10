// @flow
import React, {Component} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import {Header} from "./Header";
import {type Node, GraphVisualizer} from "../../../visualizer/GraphVisualizer";
import {type Edge} from "../../../core/graph";
import {color} from "../../../visualizer/constants";

export type SidebarDeclaration = {|
  +type: string,
  +title: string,
|};
export type Props = {|
  nodes: $ReadOnlyArray<Node>,
  edges: $ReadOnlyArray<Edge>,
  sidebarDeclarations: $ReadOnlyArray<SidebarDeclaration>,
|};

export class OdysseyApp extends Component<Props> {
  scoreList(title: string, entities: $ReadOnlyArray<Node>) {
    const entries = entities.map(
      ({description, score, address, scoreRatio}) => (
        <div key={address} className={css(styles.entityRow)}>
          <div className={css(styles.entityName)}>{description}</div>
          <div
            className={css(styles.entityScore)}
            style={{color: color(scoreRatio)}}
          >
            {score.toFixed(0)} ¤
          </div>
        </div>
      )
    );
    return (
      <div className={css(styles.scoreList)}>
        <h1 className={css(styles.scoreListTitle)}>{title}</h1>
        {entries}
      </div>
    );
  }

  sidebarFor(sd: SidebarDeclaration) {
    const nodes = this.props.nodes.filter((n) => n.type === sd.type);
    return this.scoreList(sd.title, nodes);
  }

  render() {
    return (
      <div className={css(styles.app)}>
        <Header />

        <div className={css(styles.nonHeader)}>
          <div className={css(styles.scoreListsContainer)}>
            {this.props.sidebarDeclarations.map((d) => this.sidebarFor(d))}
          </div>

          <div className={css(styles.chartContainer)}>
            <GraphVisualizer
              nodes={this.props.nodes}
              edges={this.props.edges}
            />
          </div>
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
    display: "flex",
  },
});
