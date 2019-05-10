// @flow

import React, {Component} from "react";
import {StyleSheet, css} from "aphrodite/no-important";
import sortBy from "lodash.sortby";

import {Header} from "./Header";
import {type Node, GraphVisualizer} from "../../../visualizer/GraphVisualizer";
import type {Size} from "../../../visualizer/types";
import {type Edge} from "../../../core/graph";
import {color, BACKGROUND_COLOR} from "../../../visualizer/constants";

export type SidebarDeclaration = {|
  +type: string,
  +title: string,
|};
export type Props = {|
  +instanceName: string,
  +nodes: $ReadOnlyArray<Node>,
  +edges: $ReadOnlyArray<Edge>,
  +sidebarDeclarations: $ReadOnlyArray<SidebarDeclaration>,
|};

export type State = {|
  visualizerSize: Size,
|};

export class OdysseyApp extends Component<Props, State> {
  visualizerContainer: ?HTMLDivElement;
  state = {visualizerSize: {width: 0, height: 0}};

  scoreList(title: string, entities: $ReadOnlyArray<Node>) {
    const entries = sortBy(entities, (x) => -x.score).map(
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

  componentDidMount() {
    // The if-null check is to re-assure flow; we know that it must be be
    // rendered since the component has mounted.
    if (this.visualizerContainer != null) {
      const width = this.visualizerContainer.offsetWidth;
      const height = this.visualizerContainer.offsetHeight;
      this.setState({
        visualizerSize: {width, height},
      });
    }
  }

  render() {
    return (
      <div className={css(styles.app)}>
        <Header instanceName={this.props.instanceName} />

        <div className={css(styles.nonHeader)}>
          <div className={css(styles.scoreListsContainer)}>
            {this.props.sidebarDeclarations.map((d) => this.sidebarFor(d))}
          </div>

          <div
            ref={(div) => (this.visualizerContainer = div)}
            className={css(styles.chartContainer)}
          >
            <GraphVisualizer
              nodes={this.props.nodes}
              edges={this.props.edges}
              size={this.state.visualizerSize}
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
    flexGrow: 1,
  },

  chartContainer: {
    width: "100%",
    display: "flex",
    backgroundColor: BACKGROUND_COLOR,
  },
});
