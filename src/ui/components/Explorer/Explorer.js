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
} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import deepEqual from "lodash.isequal";
import {sum} from "d3-array";
import {CredView} from "../../../analysis/credView";
import sortBy from "../../../util/sortBy";
import {
  type WeightsT,
  copy as weightsCopy,
  empty as emptyWeights,
} from "../../../core/weights";
import {
  defaultParams,
  type TimelineCredParameters,
} from "../../../analysis/timeline/params";

import NodeRow from "./NodeRow";
import FilterSelect, {type FilterState, DEFAULT_FILTER} from "./FilterSelect";
import WeightsConfigSection from "./WeightsConfigSection";

const useStyles = makeStyles((theme) => ({
  combobox: {
    margin: "0px 32px 16px",
  },
  parentGrid: {
    marginTop: theme.spacing(1),
  },
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
}));

export const Explorer = ({
  initialView,
}: {
  initialView: CredView | null,
}): ReactNode => {
  const [{credView}, setCredViewState] = useState({
    credView: initialView,
  });

  const updateCredView = (credView: CredView) => setCredViewState({credView});

  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  const [recalculating, setRecalculating] = useState(false);
  const [showWeightConfig, setShowWeightConfig] = useState(false);
  const classes = useStyles();

  // TODO: Allow sorting/displaying only recent cred...
  const sortedNodes = useMemo(() => {
    if (!credView) return {sortedNodes: [], total: 0};

    const nodes =
      filterState.filter == null
        ? credView.userNodes()
        : credView.nodes({prefix: filterState.filter});
    const total: number = sum(nodes.map((n) => n.credSummary.cred));
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred)
      .slice(0, 200)
      .map((node) => (
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
      ));
    return sortedNodes;
  }, [filterState.filter, credView]);

  const [{weights}, setWeightsState] = useState<{weights: WeightsT}>({
    weights: credView ? weightsCopy(credView.weights()) : emptyWeights(),
  });
  const [params, setParams] = useState<TimelineCredParameters>({
    ...(credView ? credView.params() : defaultParams()),
  });

  const recomputeCred = async () =>
    //weights: WeightsT,
    //params: TimelineCredParameters
    {
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

  if (!credView)
    return (
      <div className={classes.root}>
        <p>
          This page is unavailable because Cred information was unable to load.
          Calculate cred through the CLI in order to use this page.
        </p>
      </div>
    );

  return (
    <div className={classes.root}>
      <Grid
        container
        item
        xs={12}
        direction="row"
        justify="space-between"
        alignItems="center"
        className={classes.parentGrid}
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
      {recalculating ? <h1>Recalculating...</h1> : ""}
      <WeightsConfigSection
        show={showWeightConfig}
        credView={credView}
        weights={weights}
        setWeightsState={setWeightsState}
        params={params}
        setParams={setParams}
      />
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{filterState.name}</TableCell>
            <TableCell className={classes.credCell}>Cred</TableCell>
            <TableCell className={classes.credCell}>% Total</TableCell>
            <TableCell className={classes.endCell} />
          </TableRow>
        </TableHead>
        <TableBody>{sortedNodes}</TableBody>
      </Table>
    </div>
  );
};
