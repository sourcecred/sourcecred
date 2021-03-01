// @flow
import React, {useState, useMemo, type Node as ReactNode} from "react";
import {
  Checkbox,
  Container,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import deepFreeze from "deep-freeze";
import bigInt from "big-integer";
import {CredGrainView} from "../../../core/credGrainView";
import {
  useTableState,
  SortOrders,
  DEFAULT_SORT,
} from "../../../webutil/tableState";
import type {CurrencyDetails} from "../../../api/currencyConfig";
import {
  format,
  add,
  div,
  fromInteger,
  type Grain,
} from "../../../core/ledger/grain";
import ExplorerTimeline from "./ExplorerTimeline";
import {IdentityTypes} from "../../../core/identity/identityType";
import {type Interval, type IntervalSequence} from "../../../core/interval";
import {formatTimestamp} from "../../utils/dateHelpers";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    minWidth: "1100px",
    margin: "0 auto",
    padding: "0 5em 5em",
  },
  arrowBody: {
    color: theme.palette.text.primary,
    flex: 1,
    background: theme.palette.background.paper,
    padding: "5px 20px",
    display: "flex",
    alignItems: "center",
  },
  triangle: {
    width: 0,
    height: 0,
    background: theme.palette.background,
    borderTop: "30px solid transparent",
    borderBottom: "30px solid transparent",
    borderLeft: `30px solid ${theme.palette.background.paper}`,
  },
  circle: {
    height: "128px",
    width: "128px",
    border: `1px solid ${theme.palette.text.primary}`,
    color: theme.palette.text.primary,
    borderRadius: "50%",
    fontSize: "21px",
    margin: "10px",
  },
  circleWrapper: {
    fontSize: "21px",
    flex: 1,
    margin: "13px",
    flexDirection: "column",
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  rightRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  row: {display: "flex"},
  graph: {
    height: "150px",
  },
  barChartWrapper: {flexGrow: 1, flexBasis: 0, margin: "20px"},
  tableWrapper: {flexGrow: 0, flexBasis: 0, margin: "20px auto"},
  checklabel: {
    margin: "5px",
  },
  barChart: {
    height: "500px",
    width: "100%",
    background: "grey",
  },
  element: {flex: 1, margin: "20px"},
  arrowInput: {width: "40%", display: "inline-block"},
  pageHeader: {color: theme.palette.text.primary},
  credCircle: {
    borderColor: theme.palette.blueish,
    "& .title": {
      color: theme.palette.blueish,
    },
  },
  grainCircle: {
    borderColor: theme.palette.warning.main,
    "& .title": {
      color: theme.palette.warning.main,
    },
  },
  [`label-${IdentityTypes.BOT}`]: {
    color: theme.palette.purple,
  },
  [`label-${IdentityTypes.PROJECT}`]: {
    color: theme.palette.orange,
  },
  [`label-${IdentityTypes.ORGANIZATION}`]: {
    color: theme.palette.orange,
  },
  labelCred: {
    color: theme.palette.blueish,
  },
  labelGrain: {
    color: theme.palette.darkOrange,
  },
  rowAverage: {
    fontStyle: "italic",
  },
}));

const CRED_SORT = deepFreeze({
  name: Symbol("Cred"),
  fn: (n) => n.cred,
});
const GRAIN_SORT = deepFreeze({
  name: Symbol("Grain"),
  fn: (n) => bigInt(n.grainEarned),
});
const PAGINATION_OPTIONS = deepFreeze([50, 100, 200]);
const TIMEFRAME_OPTIONS: Array<{|
  +tabLabel: string,
  +tableLabel: string,
  +selector: (IntervalSequence) => Interval,
|}> = deepFreeze([
  {
    tabLabel: "This Week",
    tableLabel: "This Week’s Activity",
    selector: (intervals) => intervals[intervals.length - 1],
  },
  {
    tabLabel: "Last Week",
    tableLabel: "Last Week’s Activity",
    selector: (intervals) =>
      intervals.length === 1 ? intervals[0] : intervals[intervals.length - 2],
  },
  {
    tabLabel: "This Month",
    tableLabel: "This Month’s Activity",
    selector: (intervals) =>
      intervals.length < 5
        ? {
            startTimeMs: intervals[0].startTimeMs,
            endTimeMs: intervals[intervals.length - 1].endTimeMs,
          }
        : {
            startTimeMs: intervals[intervals.length - 5].startTimeMs,
            endTimeMs: intervals[intervals.length - 2].endTimeMs,
          },
  },
  {
    tabLabel: "All Time",
    tableLabel: "All Time Activity",
    selector: (intervals) =>
      intervals.length === 1
        ? intervals[0]
        : {
            startTimeMs: intervals[0].startTimeMs,
            endTimeMs: intervals[intervals.length - 1].endTimeMs,
          },
  },
]);

type ExplorerHomeProps = {|
  +initialView: CredGrainView | null,
  +currency: CurrencyDetails,
|};

export const ExplorerHome = ({
  initialView,
  currency: {suffix: currencySuffix, name: currencyName},
}: ExplorerHomeProps): ReactNode => {
  if (!initialView) return null;

  const classes = useStyles();
  // default view is Last Week's Activity (array index 1)
  const [tab, setTab] = useState<number>(1);
  const [selectedInterval, setSelectedInterval] = useState<Interval>(
    TIMEFRAME_OPTIONS[1].selector(initialView.intervals())
  );
  const [checkboxes, setCheckboxes] = useState({
    [IdentityTypes.USER]: false,
    [IdentityTypes.ORGANIZATION]: false,
    [IdentityTypes.BOT]: false,
    [IdentityTypes.PROJECT]: false,
  });

  const updateTimeframe = (index) => {
    setTab(index);
    setSelectedInterval(
      TIMEFRAME_OPTIONS[index].selector(initialView.intervals())
    );
  };

  const allTimeContributionCharts = {};
  for (const participant of initialView.participants()) {
    allTimeContributionCharts[String(participant.identity.id)] =
      participant.credPerInterval;
  }

  const timeScopedCredGrainView = useMemo(
    () =>
      initialView.withTimeScope(
        selectedInterval.startTimeMs,
        selectedInterval.endTimeMs
      ),
    [selectedInterval]
  );

  const allParticipants = useMemo(
    () => Array.from(timeScopedCredGrainView.participants()),
    [timeScopedCredGrainView]
  );

  const {credTotalsTimeline, grainTotalsTimeline} = useMemo(() => {
    const allParticipantsCred: Array<Array<number>> = allParticipants.map(
      (participant) => {
        return participant.credPerInterval.slice();
      }
    );
    const allParticipantsGrain: Array<Array<Grain>> = allParticipants.map(
      (participant) => {
        return participant.grainEarnedPerInterval.slice();
      }
    );
    const credAccumulator = (
      credTimelineAccumalator: Array<number>,
      participantCred
    ) =>
      credTimelineAccumalator.map(
        (intervalTotal, i) => intervalTotal + participantCred[i]
      );
    const grainAccumulator = (
      grainTimelineAccumalator: Array<Grain>,
      participantGrain
    ) =>
      grainTimelineAccumalator.map((intervalTotal, i) =>
        add(intervalTotal, participantGrain[i])
      );
    const credTimeline: Array<number> = allParticipantsCred.reduce(
      credAccumulator
    );
    const grainTimeline: Array<Grain> = allParticipantsGrain.reduce(
      grainAccumulator
    );
    return {
      credTotalsTimeline: credTimeline,
      grainTotalsTimeline: grainTimeline,
    };
  }, [timeScopedCredGrainView]);

  const tsParticipants = useTableState(
    {data: allParticipants},
    {
      initialRowsPerPage: PAGINATION_OPTIONS[0],
      initialSort: {
        sortName: CRED_SORT.name,
        sortOrder: SortOrders.DESC,
        sortFn: CRED_SORT.fn,
      },
    }
  );

  const {credAndGrainSummary} = useMemo(() => {
    const credAndGrainAggregator = {
      totalCred: 0,
      totalGrain: fromInteger(0),
      avgCred: 0,
      avgGrain: fromInteger(0),
    };
    if (tsParticipants.currentPage.length > 0) {
      for (const participant of tsParticipants.currentPage) {
        credAndGrainAggregator.totalCred += participant.cred;
        credAndGrainAggregator.totalGrain = add(
          participant.grainEarned,
          credAndGrainAggregator.totalGrain
        );
      }
      credAndGrainAggregator.avgCred =
        credAndGrainAggregator.totalCred / tsParticipants.currentPage.length;
      credAndGrainAggregator.avgGrain = div(
        credAndGrainAggregator.totalGrain,
        fromInteger(tsParticipants.currentPage.length)
      );
    }
    return {
      credAndGrainSummary: credAndGrainAggregator,
    };
  }, [tsParticipants.currentPage]);

  const statCircleInfo = [
    {
      title: `Cred ${TIMEFRAME_OPTIONS[tab].tabLabel}`,
      value: Math.round(credAndGrainSummary.totalCred).toLocaleString(),
      className: classes.credCircle,
    },
    {
      title: `${currencyName}`,
      value: format(credAndGrainSummary.totalGrain, 0, currencySuffix),
      className: classes.grainCircle,
    },
  ];

  const filterIdentities = (event: SyntheticInputEvent<HTMLInputElement>) => {
    // fuzzy match letters "in order, but not necessarily sequentially"
    const filterString = event.target.value
      .trim()
      .toLowerCase()
      .split("")
      .join("+.*");
    const regex = new RegExp(filterString);

    tsParticipants.createOrUpdateFilterFn("filterIdentities", (participant) =>
      regex.test(participant.identity.name.toLowerCase())
    );
  };

  const handleCheckboxFilter = (event) => {
    const newCheckboxes = {
      ...checkboxes,
      [event.target.name]: event.target.checked,
    };
    setCheckboxes(newCheckboxes);

    const includedTypes = Object.keys(newCheckboxes).filter(
      (type) => newCheckboxes[type] === true
    );

    if (includedTypes.length === 0) {
      tsParticipants.createOrUpdateFilterFn("identityType", () => true);
    } else {
      tsParticipants.createOrUpdateFilterFn("identityType", (participant) =>
        includedTypes.includes(participant.identity.subtype)
      );
    }
  };

  const handleChangePage = (event, newIndex) => {
    tsParticipants.setPageIndex(newIndex);
  };

  const handleChangeRowsPerPage = (event) => {
    tsParticipants.setRowsPerPage(Number(event.target.value));
  };

  const makeCircle = (
    value: string | number,
    title: string,
    className: string
  ) => (
    <div
      className={`${classes.centerRow} ${classes.circleWrapper} ${className}`}
      key={`${title}-${value}`}
    >
      <div className={`${classes.centerRow} ${classes.circle} ${className}`}>
        {value}
      </div>
      <div className="title">{title}</div>
    </div>
  );

  const formatInterval = (interval) => {
    const formatWithYear = (timestamp) =>
      formatTimestamp(timestamp, {
        month: "short",
        day: "numeric",
        hour: undefined,
        minute: undefined,
        year: "numeric",
      });

    const formatWithoutYear = (timestamp) =>
      formatTimestamp(timestamp, {
        month: "short",
        day: "numeric",
        hour: undefined,
        minute: undefined,
        year: undefined,
      });

    const isTodayOrLater = (someDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return someDate >= today;
    };

    const startDate = new Date(interval.startTimeMs);
    const endDate = new Date(interval.endTimeMs);

    const startTime =
      startDate.getFullYear() === endDate.getFullYear()
        ? formatWithoutYear(interval.startTimeMs)
        : formatWithYear(interval.startTimeMs);

    const endTime = isTodayOrLater(endDate)
      ? "Today"
      : formatWithYear(interval.endTimeMs);

    return `${startTime} to ${endTime}`;
  };

  // const makeBarChart = () => {
  //   const margin = 60;
  //   const width = 1000 - 2 * margin;
  //   const height = 600 - 2 * margin;

  //   const svg = d3.select('svg');
  //   const chart = svg.append('g')
  //   .attr('transform', `translate(${margin}, ${margin})`);
  // }

  return (
    <Container className={classes.root}>
      <h1 className={`${classes.centerRow} ${classes.pageHeader}`}>
        Explorer Home
      </h1>
      <div className={`${classes.centerRow} ${classes.graph}`}>
        <ExplorerTimeline
          height={100}
          width={1000}
          timelines={{cred: credTotalsTimeline, grain: grainTotalsTimeline}}
          hasLegend={true}
          responsive={true}
        />
      </div>
      <div className={`${classes.rightRow}`}>
        <Tabs
          className={classes.rightRow}
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, val) => updateTimeframe(val)}
        >
          {TIMEFRAME_OPTIONS.map(({tabLabel}) => (
            <Tab key={tabLabel} label={tabLabel} />
          ))}
        </Tabs>
      </div>
      <div className={classes.centerRow}>
        {statCircleInfo.map((circle) =>
          makeCircle(circle.value, circle.title, circle.className)
        )}
      </div>
      <div className={classes.row}>
        <div className={classes.tableWrapper} style={{flexDirection: "column"}}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <span style={{fontSize: "1.5rem"}}>
              {TIMEFRAME_OPTIONS[tab].tableLabel}
            </span>
            <span style={{fontSize: "1rem"}}>
              {formatInterval(selectedInterval)}
            </span>
            <TextField
              label="Filter Names"
              variant="outlined"
              onChange={filterIdentities}
            />
          </div>
          <TableContainer component={Paper}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <b>Participant</b>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={tsParticipants.sortName === CRED_SORT.name}
                      direction={
                        tsParticipants.sortName === CRED_SORT.name
                          ? tsParticipants.sortOrder
                          : DEFAULT_SORT
                      }
                      onClick={() =>
                        tsParticipants.setSortFn(CRED_SORT.name, CRED_SORT.fn)
                      }
                    >
                      <b>{CRED_SORT.name.description}</b>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={tsParticipants.sortName === GRAIN_SORT.name}
                      direction={
                        tsParticipants.sortName === GRAIN_SORT.name
                          ? tsParticipants.sortOrder
                          : DEFAULT_SORT
                      }
                      onClick={() =>
                        tsParticipants.setSortFn(GRAIN_SORT.name, GRAIN_SORT.fn)
                      }
                    >
                      <b>{currencyName}</b>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <b>Contributions Chart (ALL TIME)</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tsParticipants.currentPage.length > 0 ? (
                  tsParticipants.currentPage.map((row) => (
                    <TableRow key={row.identity.name}>
                      <TableCell
                        component="th"
                        scope="row"
                        className={classes[`label-${row.identity.subtype}`]}
                      >
                        {row.identity.name}
                      </TableCell>
                      <TableCell className={classes.labelCred}>
                        {Math.round(row.cred).toLocaleString()}
                      </TableCell>
                      <TableCell className={classes.labelGrain}>
                        {format(row.grainEarned, 2, currencySuffix)}
                      </TableCell>
                      <TableCell align="right">
                        <ExplorerTimeline
                          timelines={{
                            cred:
                              allTimeContributionCharts[
                                String(row.identity.id)
                              ],
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow key="no-results">
                    <TableCell colSpan={4} align="center">
                      No results
                    </TableCell>
                  </TableRow>
                )}
                <TableRow key="average" className={classes.rowAverage}>
                  <TableCell component="th" scope="row">
                    Average
                  </TableCell>
                  <TableCell>
                    {credAndGrainSummary.avgCred.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    {format(credAndGrainSummary.avgGrain, 2, currencySuffix)}
                  </TableCell>
                  <TableCell align="right" />
                </TableRow>
                <TableRow key="total">
                  <TableCell component="th" scope="row">
                    <b>TOTAL</b>
                  </TableCell>
                  <TableCell>
                    <b>{credAndGrainSummary.totalCred.toFixed(1)}</b>
                  </TableCell>
                  <TableCell>
                    <b>
                      {format(
                        credAndGrainSummary.totalGrain,
                        2,
                        currencySuffix
                      )}
                    </b>
                  </TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TablePagination
                    rowsPerPageOptions={PAGINATION_OPTIONS}
                    colSpan={4}
                    count={tsParticipants.length}
                    rowsPerPage={tsParticipants.rowsPerPage}
                    page={tsParticipants.pageIndex}
                    SelectProps={{
                      inputProps: {"aria-label": "rows per page"},
                      native: true,
                    }}
                    onChangePage={handleChangePage}
                    onChangeRowsPerPage={handleChangeRowsPerPage}
                  />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          <FormGroup row className={classes.rightRow}>
            <FormLabel className={classes.checklabel} component="legend">
              SHOW:
            </FormLabel>
            <FormControlLabel
              control={
                <Checkbox
                  checked={checkboxes[IdentityTypes.USER]}
                  onChange={handleCheckboxFilter}
                  name={IdentityTypes.USER}
                />
              }
              label="Participants"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={checkboxes[IdentityTypes.BOT]}
                  onChange={handleCheckboxFilter}
                  name={IdentityTypes.BOT}
                />
              }
              label="Bots"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={checkboxes[IdentityTypes.PROJECT]}
                  onChange={handleCheckboxFilter}
                  name={IdentityTypes.PROJECT}
                />
              }
              label="Projects"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={checkboxes[IdentityTypes.ORGANIZATION]}
                  onChange={handleCheckboxFilter}
                  name={IdentityTypes.ORGANIZATION}
                />
              }
              label="Organizations"
            />
          </FormGroup>
        </div>
      </div>
    </Container>
  );
};
