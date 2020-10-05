// @flow
import React, {useMemo, useState, type Node as ReactNode} from "react";
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
  Slider,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import {StyleSheet, css} from "aphrodite/no-important";
import deepEqual from "lodash.isequal";
import {format} from "d3-format";
import {sum} from "d3-array";
import {CredView} from "../../../analysis/credView";
import sortBy from "../../../util/sortBy";
import {type NodeAddressT} from "../../../core/graph";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";
import {
  type Weights,
  copy as weightsCopy,
  empty as emptyWeights,
} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";
import {
  defaultParams,
  type TimelineCredParameters,
} from "../../../analysis/timeline/params";

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

export type FilterState = {|
  // Whether to filter down to a particular type prefix.
  // If unset, shows all user-typed nodes
  filter: NodeAddressT | null,
  anchorEl: HTMLElement | null,
  name: string | null,
|};

const FilterSelect = ({
  credView,
  filterState,
  setFilterState,
}: {
  credView: CredView,
  filterState: FilterState,
  setFilterState: (FilterState) => void,
}) => {
  const plugins = credView.plugins();

  const handleMenuClose = () =>
    setFilterState({...filterState, anchorEl: null});

  const optionGroup = (declaration: PluginDeclaration) => {
    const header = (
      <MenuItem
        key={declaration.nodePrefix}
        value={declaration.nodePrefix}
        className={css(styles.menuHeader)}
        onClick={() =>
          setFilterState({
            anchorEl: null,
            filter: declaration.nodePrefix,
            name: declaration.name,
          })
        }
      >
        {declaration.name}
      </MenuItem>
    );
    const entries = declaration.nodeTypes.map((type, index) => (
      <MenuItem
        key={index}
        value={type.prefix}
        onClick={() =>
          setFilterState({
            anchorEl: null,
            filter: type.prefix,
            name: type.name,
          })
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
          onClick={(event) =>
            setFilterState({
              ...filterState,
              anchorEl: event.currentTarget,
            })
          }
        >
          <ListItemText
            primary={
              filterState.name ? `Filter: ${filterState.name}` : "Filter"
            }
          />
          {filterState.anchorEl ? (
            <KeyboardArrowUpIcon />
          ) : (
            <KeyboardArrowDownIcon />
          )}
        </ListItem>
        <Divider className={css(styles.divider)} />
      </List>

      <Menu
        id="lock-menu"
        anchorEl={filterState.anchorEl}
        keepMounted
        open={Boolean(filterState.anchorEl)}
        onClose={handleMenuClose}
        getContentAnchorEl={null}
        anchorOrigin={{vertical: "bottom", horizontal: "left"}}
        transformOrigin={{vertical: "top", horizontal: "left"}}
      >
        <MenuItem
          key={"All users"}
          value={""}
          className={css(styles.menuHeader)}
          onClick={() =>
            setFilterState({
              anchorEl: null,
              filter: null,
              name: "All users",
            })
          }
        >
          All users
        </MenuItem>
        {plugins.map(optionGroup)}
      </Menu>
    </>
  );
};

type WeightConfigSectionProps = {|
  show: boolean,
  credView: CredView,
  weights: Weights,
  setWeightsState: ({weights: Weights}) => void,
  params: TimelineCredParameters,
  setParams: (TimelineCredParameters) => void,
|};

const WeightsConfigSection = ({
  show,
  credView,
  weights,
  setWeightsState,
  params,
  setParams,
}: WeightConfigSectionProps) => {
  if (!show) return [];
  return (
    <Grid container>
      <Grid container className={css(styles.weightConfig)} spacing={2}>
        <Grid container item xs={12} direction="column">
          <Grid>
            <Grid>Upload/Download weights:</Grid>
            <Grid>
              <WeightsFileManager
                weights={weights}
                onWeightsChange={(weights: Weights) => {
                  setWeightsState({weights});
                }}
              />
            </Grid>
          </Grid>
          <Grid container item spacing={2} alignItems="center">
            <Grid>α</Grid>
            <Grid item xs={2}>
              <Slider
                value={params.alpha}
                min={0.05}
                max={0.95}
                step={0.05}
                valueLabelDisplay="auto"
                onChange={(_, val) => {
                  setParams({
                    ...params,
                    alpha: val,
                  });
                }}
              />
            </Grid>
            <Grid>{format(".2f")(params.alpha)}</Grid>
          </Grid>
        </Grid>
        <Grid spacing={2} container item xs={12} style={{display: "flex"}}>
          <WeightConfig
            declarations={credView.plugins()}
            nodeWeights={weights.nodeWeights}
            edgeWeights={weights.edgeWeights}
            onNodeWeightChange={(prefix, weight) => {
              weights.nodeWeights.set(prefix, weight);

              setWeightsState({weights});
            }}
            onEdgeWeightChange={(prefix, weight) => {
              weights.edgeWeights.set(prefix, weight);
              setWeightsState({weights});
            }}
          />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Explorer = ({initialView}: {initialView: CredView}): ReactNode => {
  const [{credView}, setCredViewState] = useState({
    credView: initialView,
  });

  const updateCredView = (credView: CredView) => setCredViewState({credView});

  const [filterState, setFilterState] = useState<FilterState>({
    anchorEl: null,
    filter: null,
    name: null,
  });

  const [recalculating, setRecalculating] = useState(false);

  const [showWeightConfig, setShowWeightConfig] = useState(false);

  // TODO: Allow sorting/displaying only recent cred...
  const {sortedNodes, total} = useMemo(() => {
    if (!credView) return {sortedNodes: [], total: 0};
    const nodes =
      filterState.filter == null
        ? credView.userNodes()
        : credView.nodes({prefix: filterState.filter});
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
    const total: number = sum(nodes.map((n) => n.credSummary.cred));
    return {sortedNodes, total};
  }, [filterState.filter, credView]);

  const [{weights}, setWeightsState] = useState<{weights: Weights}>({
    weights: credView ? weightsCopy(credView.weights()) : emptyWeights(),
  });
  const [params, setParams] = useState<TimelineCredParameters>({
    ...(credView ? credView.params() : defaultParams()),
  });

  const recomputeCred = async (
    weights: Weights,
    params: TimelineCredParameters
  ) => {
    if (!credView) return;
    setRecalculating(true);
    try {
      const newCredView = await credView.recompute(weights, params);
      updateCredView(newCredView);
    } catch (e) {
      console.log(e);
      alert("Error recomputing cred, check console");
    } finally {
      setRecalculating(false);
    }
  };

  const currentParams = credView ? credView.params() : null;
  const currentWeights = credView ? credView.weights() : null;

  const paramsUpToDate =
    deepEqual(params, currentParams) && deepEqual(weights, currentWeights);

  if (!credView) return null;

  return (
    <div className={css(styles.root)}>
      <Grid
        container
        item
        xs={12}
        direction="row"
        justify="space-between"
        alignItems="center"
        className={css(styles.parentGrid)}
      >
        <Grid container item xs>
          <FilterSelect
            credView={credView}
            filterState={filterState}
            setFilterState={setFilterState}
          />
        </Grid>
        <Grid container item xs>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setShowWeightConfig((show) => !show);
            }}
          >
            {showWeightConfig
              ? "Hide weight configuration"
              : "Show weight configuration"}
          </Button>
        </Grid>
        <Grid container item xs>
          <Button
            variant="contained"
            color="primary"
            disabled={recalculating || paramsUpToDate}
            onClick={recomputeCred}
          >
            re-compute cred
          </Button>
        </Grid>
      </Grid>
      <WeightsConfigSection
        show={showWeightConfig}
        credView={credView}
        weights={weights}
        setWeightsState={setWeightsState}
        params={params}
        setParams={setParams}
      />
      {recalculating ? <h1>Recalculating...</h1> : ""}
      <Table className={css(styles.table)}>
        <TableHead>
          <TableRow>
            <TableCell>
              {filterState.name ? filterState.name : "All users"}
            </TableCell>
            <TableCell className={css(styles.credCell)}>Cred</TableCell>
            <TableCell className={css(styles.credCell)}>% Total</TableCell>
            <TableCell className={css(styles.endCell)} />
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedNodes.slice(0, 200).map((node) => (
            <NodeRow
              depth={0}
              key={node.address}
              node={node}
              view={credView}
              total={total}
              // We only show the cred charts for users, because in CredRank we might not have
              // cred-over-time data available for non-users.
              // Would rather not add a feature that we may later need to remove.
              showChart={!filterState.filter}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
