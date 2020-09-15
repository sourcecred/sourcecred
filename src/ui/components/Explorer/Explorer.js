// @flow
import React, {type Node as ReactNode} from "react";
import {
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Menu,
  MenuItem,
  ListItem,
  ListItemText,
  List,
  Divider,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import {StyleSheet, css} from "aphrodite/no-important";
import deepEqual from "lodash.isequal";
import {format} from "d3-format";
import {sum} from "d3-array";
import {CredView} from "../../../analysis/credView";
import sortBy from "../../../util/sortBy";
import type {NodeType} from "../../../analysis/types";
import {type NodeAddressT, type EdgeAddressT} from "../../../core/graph";
import {
  type PluginDeclaration,
  type PluginDeclarations,
} from "../../../analysis/pluginDeclaration";
import {
  type Weights,
  type EdgeWeight,
  copy as weightsCopy,
} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";
import {type TimelineCredParameters} from "../../../analysis/timeline/params";

import NodeRow from "./NodeRow";

const styles = StyleSheet.create({
  combobox: {margin: "0px 32px 16px"},
  menuHeader: {fontWeight: "bold"},
  divider: {backgroundColor: "#F20057", height: "2px"},
  parentGrid: {marginTop: 30},
  weightConfig: {marginTop: 10},
  root: {
    width: "80%",
    margin: "0 auto",
    padding: "0 5em 5em",
  },
  table: {
    width: "100%",
    tableLayout: "fixed",
    margin: "0 auto",
    padding: "20px 10px",
  },
  credCell: {
    width: "10%",
  },
  endCell: {
    width: "30%",
  },
});

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
  anchorEl: HTMLElement | null,
  name: string | null,
|};

export type RenderFilterSelectProps = {|
  +handleMenuClose: () => void,
  +anchorEl: HTMLElement | null,
  +declarations: PluginDeclarations,
  +filterByNodeType: (nodeType: NodeType) => void,
  +filterByDeclaration: (declaration: PluginDeclaration) => void,
  +setAnchorEl: (anchorEl: HTMLElement | null) => void,
  +name: string | null,
  +resetFilter: () => void,
|};

export type RenderConfigureRowProps = {|
  +analyzeCred: () => Promise<void>,
  +recalculating: boolean,
  +setParams: (params: TimelineCredParameters) => void,
  +weights: Weights,
  +params: TimelineCredParameters,
  +showWeightConfig: boolean,
  +toggleShowWeightConfig: () => void,
  +onNodeWeightChange: (prefix: NodeAddressT, weight: number) => void,
  +onEdgeWeightChange: (prefix: EdgeAddressT, weight: EdgeWeight) => void,
  +view: CredView,
  +setWeights: (weights: Weights) => void,
  +handleMenuClose: () => void,
  +anchorEl: HTMLElement | null,
  +declarations: PluginDeclarations,
  +filterByNodeType: (nodeType: NodeType) => void,
  +filterByDeclaration: (declaration: PluginDeclaration) => void,
  +setAnchorEl: (anchorEl: HTMLElement | null) => void,
  +name: string | null,
  +resetFilter: () => void,
  +renderFilterSelect: (props: RenderFilterSelectProps) => ReactNode,
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
      name: null,
    };
  }

  setAnchorEl = (anchorEl: HTMLElement | null) => this.setState({anchorEl});
  setWeights = (weights: Weights) => this.setState({weights});
  toggleShowWeightConfig = () =>
    this.setState(({showWeightConfig}) => ({
      showWeightConfig: !showWeightConfig,
    }));

  handleMenuClose = () => this.setAnchorEl(null);

  filterByNodeType = (nodeType: NodeType) =>
    this.setState({
      anchorEl: null,
      filter: nodeType.prefix,
      name: nodeType.name,
    });

  filterByDeclaration = (declaration: PluginDeclaration) =>
    this.setState({
      anchorEl: null,
      filter: declaration.nodePrefix,
      name: declaration.name,
    });

  resetFilter = () =>
    this.setState({
      anchorEl: null,
      filter: null,
      name: "All users",
    });

  onNodeWeightChange = (prefix: NodeAddressT, weight: number) =>
    this.setState(({weights}) => {
      weights.nodeWeights.set(prefix, weight);
      return {weights};
    });

  onEdgeWeightChange = (prefix: EdgeAddressT, weight: EdgeWeight) =>
    this.setState(({weights}) => {
      weights.edgeWeights.set(prefix, weight);
      return {weights};
    });

  setParams = (newParams: TimelineCredParameters) =>
    this.setState({params: newParams});

  // Renders the dropdown that lets the user select a type
  renderFilterSelect({
    handleMenuClose,
    resetFilter,
    filterByNodeType,
    filterByDeclaration,
    name,
    anchorEl,
    setAnchorEl,
    declarations,
  }: RenderFilterSelectProps) {
    const optionGroup = (declaration: PluginDeclaration) => {
      const header = (
        <MenuItem
          key={declaration.nodePrefix}
          value={declaration.nodePrefix}
          className={css(styles.menuHeader)}
          onClick={() => filterByDeclaration(declaration)}
        >
          {declaration.name}
        </MenuItem>
      );
      const entries = declaration.nodeTypes.map((nodeType, index) => (
        <MenuItem
          key={index}
          value={nodeType.prefix}
          onClick={() => filterByNodeType(nodeType)}
        >
          {"\u2003" + nodeType.name}
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
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <ListItemText primary={name ? `Filter: ${name}` : "Filter"} />
            {anchorEl ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </ListItem>
          <Divider className={css(styles.divider)} />
        </List>

        <Menu
          id="lock-menu"
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          getContentAnchorEl={null}
          anchorOrigin={{vertical: "bottom", horizontal: "left"}}
          transformOrigin={{vertical: "top", horizontal: "left"}}
        >
          <MenuItem
            key={"All users"}
            value={""}
            className={css(styles.menuHeader)}
            onClick={resetFilter}
          >
            All users
          </MenuItem>
          {declarations.map(optionGroup)}
        </Menu>
      </>
    );
  }

  renderConfigurationRow({
    analyzeCred,
    recalculating,
    setParams,
    setWeights,
    toggleShowWeightConfig,
    renderFilterSelect,
    showWeightConfig,
    onNodeWeightChange,
    onEdgeWeightChange,
    view,
    params,
    weights,
    handleMenuClose,
    resetFilter,
    filterByNodeType,
    filterByDeclaration,
    name,
    anchorEl,
    setAnchorEl,
    declarations,
  }: RenderConfigureRowProps) {
    const weightFileManager = (
      <WeightsFileManager weights={weights} onWeightsChange={setWeights} />
    );
    const weightConfig = (
      <WeightConfig
        declarations={declarations}
        nodeWeights={weights.nodeWeights}
        edgeWeights={weights.edgeWeights}
        onNodeWeightChange={onNodeWeightChange}
        onEdgeWeightChange={onEdgeWeightChange}
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
          setParams(newParams);
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
          disabled={recalculating || paramsUpToDate}
          onClick={analyzeCred}
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
          className={css(styles.parentGrid)}
        >
          <Grid container item xs>
            {renderFilterSelect({
              handleMenuClose,
              resetFilter,
              filterByNodeType,
              filterByDeclaration,
              name,
              anchorEl,
              setAnchorEl,
              declarations,
            })}
          </Grid>
          <Grid container item xs>
            <Button
              variant="contained"
              color="primary"
              onClick={toggleShowWeightConfig}
            >
              {showWeightConfig
                ? "Hide weight configuration"
                : "Show weight configuration"}
            </Button>
          </Grid>
          {analyzeButton}
        </Grid>
        {showWeightConfig && (
          <div className={css(styles.weightConfig)}>
            <span>Upload/Download weights:</span>
            {weightFileManager}
            <span>α</span>
            {alphaSlider}
            <span>{format(".2f")(params.alpha)}</span>
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
    const {
      analyzeCred,
      setParams,
      setAnchorEl,
      setWeights,
      toggleShowWeightConfig,
      handleMenuClose,
      renderFilterSelect,
      resetFilter,
      filterByNodeType,
      filterByDeclaration,
      onNodeWeightChange,
      onEdgeWeightChange,
    } = this;
    const {
      filter,
      view,
      recalculating,
      name,
      showWeightConfig,
      params,
      weights,
      anchorEl,
    } = this.state;
    const nodes =
      filter == null ? view.userNodes() : view.nodes({prefix: filter});
    // TODO: Allow sorting/displaying only recent cred...
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
    const total = sum(nodes.map((n) => n.credSummary.cred));
    return (
      <div className={css(styles.root)}>
        {this.renderConfigurationRow({
          analyzeCred,
          recalculating,
          setParams,
          setWeights,
          toggleShowWeightConfig,
          renderFilterSelect,
          showWeightConfig,
          onNodeWeightChange,
          onEdgeWeightChange,
          view,
          params,
          weights,
          handleMenuClose,
          resetFilter,
          filterByNodeType,
          filterByDeclaration,
          name,
          anchorEl,
          setAnchorEl,
          declarations: view.plugins(),
        })}
        {recalculating ? <h1>Recalculating...</h1> : ""}
        <Table className={css(styles.table)}>
          <TableHead>
            <TableRow>
              <TableCell align="left">{name ? name : "All users"}</TableCell>
              <TableCell align="right" className={css(styles.credCell)}>
                Cred
              </TableCell>
              <TableCell align="right" className={css(styles.credCell)}>
                % Total
              </TableCell>
              <TableCell
                align="right"
                className={css(styles.endCell)}
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
