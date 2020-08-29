// @flow

import React, {type Node as ReactNode} from "react";
import {
  Button,
  IconButton,
  Grid,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Collapse,
  Menu,
  MenuItem,
  ListItem,
  ListItemText,
  List,
  Divider,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import deepEqual from "lodash.isequal";
import {StyleSheet, css} from "aphrodite/no-important";
import Markdown from "react-markdown";
import {format} from "d3-format";
import {sum, extent} from "d3-array";
import {
  CredView,
  type CredNode,
  type Flow,
  type EdgeFlow,
} from "../../analysis/credView";
import sortBy from "../../util/sortBy";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";
import {type NodeAddressT} from "../../core/graph";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import * as NullUtil from "../../util/null";
import {type Weights, copy as weightsCopy} from "../../core/weights";
import {WeightConfig} from "../weights/WeightConfig";
import {WeightsFileManager} from "../weights/WeightsFileManager";
import {type TimelineCredParameters} from "../../analysis/timeline/params";

export type ExplorerProps = {|
  +initialView: CredView,
|};

export type ExplorerState = {|
  // Whether to filter down to a particular type prefix.
  // If unset, shows all user-typed nodes
  filter: NodeAddressT | null,
  weights: Weights,
  params: TimelineCredParameters,
  showWeightConfig: boolean,
  view: CredView,
  recalculating: boolean,
  anchorEl: any,
  selectedIndex: number,
  name: string | null,
|};

export class Explorer extends React.Component<ExplorerProps, ExplorerState> {
  constructor(props: ExplorerProps) {
    super(props);
    const view = props.initialView;
    this.state = {
      view,
      filter: null,
      weights: weightsCopy(view.weights()),
      params: {...view.params()},
      showWeightConfig: false,
      recalculating: false,
      anchorEl: null,
      selectedIndex: 1,
      name: null,
    };
  }

  handleClickListItem = (event) => {
    this.setState({
      anchorEl: event.currentTarget,
    });
  };

  handleMenuItemClick = (index, filter, name) => {
    this.setState({
      selectedIndex: index,
      anchorEl: null,
      filter,
      name,
    });
  };

  handleMenuClose = () => {
    this.setState({
      anchorEl: null,
    });
  };

  // Renders the dropdown that lets the user select a type
  renderFilterSelect() {
    const plugins = this.state.view.plugins();
    const optionGroup = (declaration: PluginDeclaration) => {
      const header = (
        <MenuItem
          key={declaration.nodePrefix}
          value={declaration.nodePrefix}
          style={{fontWeight: "bold"}}
          onClick={(event) =>
            this.handleMenuItemClick(
              0,
              declaration.nodePrefix,
              declaration.name
            )
          }
        >
          {declaration.name}
        </MenuItem>
      );
      const entries = declaration.nodeTypes.map((type, index) => (
        <MenuItem
          key={type.prefix}
          value={type.prefix}
          onClick={(event) =>
            this.handleMenuItemClick(index + 1, type.prefix, type.name)
          }
        >
          {"\u2003" + type.name}
        </MenuItem>
      ));
      return [header, ...entries];
    };
    return (
      <>
        <List component="div" aria-label="Device settings">
          <ListItem
            button
            aria-haspopup="true"
            aria-controls="filter-menu"
            aria-label="filters"
            onClick={this.handleClickListItem}
          >
            <ListItemText
              primary={NullUtil.orElse(this.state.name, "Filter")}
            />
            {this.state.anchorEl ? (
              <KeyboardArrowUpIcon />
            ) : (
              <KeyboardArrowDownIcon />
            )}
          </ListItem>
          <Divider style={{backgroundColor: "#F20057", height: "2px"}} />
        </List>

        <Menu
          id="lock-menu"
          anchorEl={this.state.anchorEl}
          keepMounted
          open={Boolean(this.state.anchorEl)}
          onClose={this.handleMenuClose}
        >
          <MenuItem
            key={"All users"}
            value={""}
            style={{fontWeight: "bold"}}
            onClick={(event) => this.handleMenuItemClick(0, null, "All users")}
          >
            All users
          </MenuItem>
          {plugins.map(optionGroup)}
        </Menu>
      </>
    );
  }

  renderConfigurationRow() {
    const {showWeightConfig, view, params, weights} = this.state;
    const weightFileManager = (
      <WeightsFileManager
        weights={weights}
        onWeightsChange={(weights: Weights) => {
          this.setState({weights});
        }}
      />
    );
    const weightConfig = (
      <WeightConfig
        declarations={view.plugins()}
        nodeWeights={weights.nodeWeights}
        edgeWeights={weights.edgeWeights}
        onNodeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.nodeWeights.set(prefix, weight);
            return {weights};
          });
        }}
        onEdgeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.edgeWeights.set(prefix, weight);
            return {weights};
          });
        }}
      />
    );

    const alphaSlider = (
      <input
        type="range"
        min={0.05}
        max={0.95}
        step={0.05}
        value={params.alpha}
        onChange={(e) => {
          const newParams = {
            ...params,
            alpha: e.target.valueAsNumber,
          };
          this.setState({params: newParams});
        }}
      />
    );
    const paramsUpToDate =
      deepEqual(params, view.params()) && deepEqual(weights, view.weights());
    const analyzeButton = (
      <Grid container item xs>
        <Button
          variant="contained"
          color="primary"
          disabled={this.state.recalculating || paramsUpToDate}
          onClick={() => this.analyzeCred()}
        >
          re-compute cred
        </Button>
      </Grid>
    );
    return (
      <Grid container>
        <Grid
          container
          direction="row"
          justify="space-between"
          alignItems="center"
          style={{marginTop: 30}}
        >
          <Grid container item xs>
            {this.renderFilterSelect()}
          </Grid>
          <Grid container item xs>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                this.setState(({showWeightConfig}) => ({
                  showWeightConfig: !showWeightConfig,
                }));
              }}
            >
              {showWeightConfig
                ? "Hide weight configuration"
                : "Show weight configuration"}
            </Button>
          </Grid>
          {analyzeButton}
        </Grid>
        {showWeightConfig && (
          <div style={{marginTop: 10}}>
            <span>Upload/Download weights:</span>
            {weightFileManager}
            <span>α</span>
            {alphaSlider}
            <span>{format(".2f")(this.state.params.alpha)}</span>
            {weightConfig}
          </div>
        )}
      </Grid>
    );
  }

  async analyzeCred() {
    this.setState({recalculating: true});
    const view = await this.state.view.recompute(
      this.state.weights,
      this.state.params
    );
    this.setState({view, recalculating: false});
  }

  render() {
    const {filter, view, recalculating} = this.state;
    const nodes =
      filter == null ? view.userNodes() : view.nodes({prefix: filter});
    // TODO: Allow sorting/displaying only recent cred...
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
    const total = sum(nodes.map((n) => n.credSummary.cred));
    return (
      <div
        style={{
          width: "80%",
          margin: "0 auto",
          background: "white",
          padding: "0 5em 5em",
        }}
      >
        {this.renderConfigurationRow()}
        {recalculating ? <h1>Recalculating...</h1> : ""}
        <Table
          style={{
            width: "100%",
            tableLayout: "fixed",
            margin: "0 auto",
            padding: "20px 10px",
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{color: "black"}}>
                Node
              </TableCell>
              <TableCell align="right" style={{width: "10%", color: "black"}}>
                Cred
              </TableCell>
              <TableCell align="right" style={{width: "10%", color: "black"}}>
                % Total
              </TableCell>
              <TableCell
                align="right"
                style={{width: "30%", color: "black"}}
              ></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedNodes.slice(0, 200).map((node) => (
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
          </TableBody>
        </Table>
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
        <CredRow
          depth={depth}
          indent={0}
          key={node.address}
          description={node.description}
          cred={cred}
          total={total}
          data={credTimeline}
        >
          {children}
        </CredRow>
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

type CredRowProps = {|
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
class CredRow extends React.Component<TableRowProps, TableRowState> {
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
        <TableRow
          style={{backgroundImage, marginLeft: depth * indent + 5}}
          className={css(styles.hoverHighlight)}
          onClick={() => {
            this.setState(({expanded}) => ({
              expanded: !expanded,
            }));
          }}
        >
          <TableCell
            style={{
              color: "black",
            }}
          >
            <IconButton
              aria-label="expand"
              color="primary"
              size="medium"
              style={{
                marginRight: 5,
                marginLeft: 15 * indent + 5,
              }}
              onClick={(e) => {
                e.stopPropagation();
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
            <Markdown renderers={{paragraph: "span"}} source={description} />{" "}
          </TableCell>
          <TableCell style={{textAlign: "right", color: "black"}}>
            {format(".1d")(cred)}
          </TableCell>
          <TableCell style={{textAlign: "right", color: "black"}}>
            {format(".1%")(cred / total)}
          </TableCell>
          <TableCell>
            <CredTimeline data={data} />
          </TableCell>
        </TableRow>
        <Collapse in={expanded} timeout="auto" unmountOnExit></Collapse>
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
    <CredRow
      key={key(f)}
      description={description}
      cred={f.flow}
      total={total}
      data={null}
      depth={depth}
      indent={1}
    >
      {children}
    </CredRow>
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
  expandDivider: {
    transition: "width 0.3s",
    width: "100%",
    ":hover": {
      width: "150%",
    },
  },
});
