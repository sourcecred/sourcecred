// @flow

import React, {type Node as ReactNode} from "react";
import {StyleSheet, css} from "aphrodite/no-important";
import Markdown from "react-markdown";
import {format} from "d3-format";
import {sum, extent} from "d3-array";
import {
  CredView,
  type CredNode,
  type Flow,
  type EdgeFlow,
} from "../analysis/credView";
import sortBy from "../util/sortBy";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";
import {type NodeAddressT} from "../core/graph";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import * as NullUtil from "../util/null";

export type ExplorerProps = {|
  +view: CredView,
|};

export type ExplorerState = {|
  // Whether to filter down to a particular type prefix.
  // If unset, shows all user-typed nodes
  filter: NodeAddressT | null,
|};

export class Explorer extends React.Component<ExplorerProps, ExplorerState> {
  constructor(props: ExplorerProps) {
    super(props);
    this.state = {filter: null};
  }

  // Renders the dropdown that lets the user select a type
  renderFilterSelect() {
    const optionGroup = (declaration: PluginDeclaration) => {
      const header = (
        <option
          key={declaration.nodePrefix}
          value={declaration.nodePrefix}
          style={{fontWeight: "bold"}}
        >
          {declaration.name}
        </option>
      );
      const entries = declaration.nodeTypes.map((type) => (
        <option key={type.prefix} value={type.prefix}>
          {"\u2003" + type.name}
        </option>
      ));
      return [header, ...entries];
    };
    return (
      <label>
        <span style={{marginLeft: "5px"}}>Showing: </span>
        <select
          value={NullUtil.orElse(this.state.filter, "")}
          onChange={(e) => {
            const filter = e.target.value || null;
            this.setState({filter});
          }}
        >
          <option key={"All users"} value={""}>
            All users
          </option>
          {this.props.view.plugins().map(optionGroup)}
        </select>
      </label>
    );
  }

  render() {
    const {view} = this.props;
    const {filter} = this.state;
    const nodes =
      filter == null ? view.userNodes() : view.nodes({prefix: filter});
    // TODO: Allow sorting/displaying only recent cred...
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
    const total = sum(nodes.map((n) => n.credSummary.cred));
    return (
      <div>
        <h1>Nodes: {view.nodes().length}</h1>
        <h1>Edges: {view.edges().length}</h1>
        {this.renderFilterSelect()}
        <table
          style={{width: "1200px", margin: "0 auto", padding: "20px 10px"}}
        >
          <thead>
            <tr>
              <th style={{textAlign: "left"}}>Node</th>
              <th style={{textAlign: "right"}}>Cred</th>
              <th style={{textAlign: "right"}}>% Total</th>
              <th style={{textAlign: "right"}}></th>
            </tr>
          </thead>
          <tbody>
            {sortedNodes.slice(0, 40).map((node) => (
              <NodeRow
                depth={0}
                key={node.address}
                node={node}
                view={view}
                total={total}
                // We only show the cred charts for users, because in CredRank we might not have
                // cred-over-time data available for non-users.
                // Would rather not add a feature that we may later need to remove.
                showChart={filter == null}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

type NodeRowProps = {
  +node: CredNode,
  +total: number,
  +view: CredView,
  +depth: number,
  +showChart: boolean,
};

class NodeRow extends React.Component<NodeRowProps> {
  render() {
    {
      const {node, total, view, depth, showChart} = this.props;
      const {credSummary, credOverTime} = node;
      const cred = credSummary.cred;
      const credTimeline =
        !showChart || credOverTime == null ? null : credOverTime.cred;
      const children = [
        <FlowsRow key={node.address} node={node} view={view} depth={depth} />,
      ];
      return (
        <TableRow
          depth={depth}
          indent={0}
          key={node.address}
          description={node.description}
          cred={cred}
          total={total}
          data={credTimeline}
        >
          {children}
        </TableRow>
      );
    }
  }
}

class FlowsRow extends React.Component<{|
  +view: CredView,
  +node: CredNode,
  +depth: number,
|}> {
  render() {
    const {view, node, depth} = this.props;
    const inflows = view.inflows(node.address);
    if (inflows == null) {
      throw new Error("no flows");
    }

    const sortedFlows = sortBy(inflows, (x) => -x.flow);
    return (
      <React.Fragment>
        {sortedFlows
          .slice(0, 10)
          .map((f) => FlowRow(view, f, node.credSummary.cred, depth))}
      </React.Fragment>
    );
  }
}

type TableRowProps = {|
  +description: string | ReactNode,
  +depth: number,
  +indent: number,
  +cred: number,
  +total: number,
  +children: ReactNode,
  +data: $ReadOnlyArray<number> | null,
|};
type TableRowState = {|
  expanded: boolean,
|};
class TableRow extends React.Component<TableRowProps, TableRowState> {
  constructor(props: TableRowProps) {
    super(props);
    this.state = {expanded: false};
  }
  render() {
    const {
      children,
      total,
      cred,
      data,
      description,
      depth,
      indent,
    } = this.props;
    const {expanded} = this.state;
    const backgroundColor = `hsla(150,100%,28%,${1 - 0.9 ** depth})`;
    const makeGradient = (color) =>
      `linear-gradient(to top, ${color}, ${color})`;
    const normalBackground = makeGradient(backgroundColor);
    const highlightBackground = makeGradient("#D8E1E8");
    const backgroundImage = `${normalBackground}, ${highlightBackground}`;
    return (
      <React.Fragment>
        <tr style={{backgroundImage}} className={css(styles.hoverHighlight)}>
          <td>
            <button
              style={{
                marginRight: 5,
                marginLeft: 15 * indent + 5,
              }}
              onClick={() => {
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? "\u2212" : "+"}
            </button>
            <Markdown renderers={{paragraph: "span"}} source={description} />
          </td>
          <td style={{textAlign: "right"}}>{format(".1d")(cred)}</td>
          <td style={{textAlign: "right"}}>{format(".1%")(cred / total)}</td>
          <td>
            <CredTimeline data={data} />
          </td>
        </tr>
        {expanded ? children : null}
      </React.Fragment>
    );
  }
}

function edgeDescription(f: EdgeFlow) {
  const {neighbor, edge} = f;
  const type = edge.type;
  const forwards = neighbor.address === edge.dst.address;
  let name = "Unknown edge to";
  if (type != null) {
    name = forwards ? type.forwardName : type.backwardName;
  }
  return name + " " + neighbor.description;
}

function FlowRow(view: CredView, f: Flow, total: number, depth: number) {
  const key = (f) => (f.type === "EDGE" ? f.edge.address : f.type);
  const description = (() => {
    switch (f.type) {
      case "RADIATE":
        return "Radiation To Seed";
      case "EDGE":
        return edgeDescription(f);
      case "MINT":
        return "Mint from Seed";
      case "SYNTHETIC_LOOP":
        return "Synthetic self-loop";
      default:
        throw new Error((f.type: empty));
    }
  })();
  const children = [];
  if (f.type === "EDGE") {
    const nodeRow = (
      <NodeRow
        key={"node"}
        view={view}
        node={f.neighbor}
        total={f.neighbor.credSummary.cred}
        depth={depth + 1}
        showChart={false}
      />
    );
    children.push(nodeRow);
  }
  return (
    <TableRow
      key={key(f)}
      description={description}
      cred={f.flow}
      total={total}
      data={null}
      depth={depth}
      indent={1}
    >
      {children}
    </TableRow>
  );
}

class CredTimeline extends React.Component<{|
  +data: $ReadOnlyArray<number> | null,
|}> {
  render() {
    const {data} = this.props;
    if (data == null) {
      return "";
    }

    const width = 300;
    const height = 25;

    const ext = extent(data);
    const xScale = scaleLinear().domain([0, data.length]).range([0, width]);
    const yScale = scaleLinear().domain(ext).range([height, 0]);
    const gen = line()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d));

    return (
      <svg width={width} height={height}>
        <path d={gen(data)} stroke="blue" fill="none" stokewidth={1} />
      </svg>
    );
  }
}

const styles = StyleSheet.create({
  /* To apply 'hoverHighlight', provide a backgroundImage containing two <image>
   * data types (eg linear gradients). The first backgroundImage will be
   * the default background. The second backgroundImage will be applied on top
   * of the first background when the user hovers or tabs over the element.
   */

  hoverHighlight: {
    backgroundSize: "100% 100%, 0 0",
    ":hover": {
      backgroundSize: "100% 100%, 100% 100%",
    },
    ":focus-within": {
      backgroundSize: "100% 100%, 100% 100%",
    },
  },
});
