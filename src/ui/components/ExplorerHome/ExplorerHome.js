// @flow
import React, {useState, useMemo, type Node as ReactNode} from "react";
import {
  Checkbox,
  Container,
  Divider,
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
import {CredGrainView} from "../../../core/credGrainView";
import {
  useTableState,
  SortOrders,
  DEFAULT_SORT,
} from "../../../webutil/tableState";
import CredTimeline from "./CredTimeline";
import {IdentityTypes} from "../../../core/identity/identityType";

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
  },
  grainCircle: {
    borderColor: theme.palette.orange,
  },
  participantCircle: {
    borderColor: theme.palette.pink,
  },
  grainPerCredCircle: {
    borderColor: theme.palette.green,
  },
}));

const CRED_SORT = deepFreeze({
  name: Symbol("Cred"),
  fn: (n) => n.cred,
});
const GRAIN_SORT = deepFreeze({
  name: Symbol("Grain"),
  fn: (n) => n.grainEarned,
});
const PAGINATION_OPTIONS = deepFreeze([25, 50, 100]);

type ExplorerHomeProps = {|
  +initialView: CredGrainView | null,
|};

export const ExplorerHome = ({initialView}: ExplorerHomeProps): ReactNode => {
  if (!initialView) return null;

  const classes = useStyles();
  const [tab, setTab] = useState<number>(1);
  const [checkboxes, setCheckboxes] = useState({
    [IdentityTypes.USER]: false,
    [IdentityTypes.ORGANIZATION]: false,
    [IdentityTypes.BOT]: false,
    [IdentityTypes.PROJECT]: false,
  });

  const allParticipants = useMemo(
    () => Array.from(initialView.participants()),
    [initialView.participants()]
  );

  const summaryInfo = [
    {title: "Cred This Week", value: 610},
    {title: "Grain Harvested", value: "6,765g"},
    {title: "Active Participants", value: allParticipants.length},
    {title: "Grain per Cred", value: "22g"},
  ];

  // sort by cred amount, highest to lowest
  const nodes = useTableState(allParticipants, {
    initialRowsPerPage: PAGINATION_OPTIONS[0],
    initialSort: {
      sortName: CRED_SORT.name,
      sortOrder: SortOrders.DESC,
      sortFn: CRED_SORT.fn,
    },
  });

  // create an array of 0s for the cred summary graph at the top of the page
  let credTimelineSummary = initialView.intervals().map(() => 0);

  const rows = nodes.currentPage.map((node) => {
    const {credPerInterval} = node;

    // add this node's cred to the summary graph
    credTimelineSummary = credTimelineSummary.map(
      (total, i) => credPerInterval[i] + total
    );

    return {
      username: node.identity.name,
      cred: node.cred,
      grain: node.grainEarned,
      chart: credPerInterval,
    };
  });

  const filterIdentities = (event: SyntheticInputEvent<HTMLInputElement>) => {
    // fuzzy match letters "in order, but not necessarily sequentially"
    const filterString = event.target.value
      .trim()
      .toLowerCase()
      .split("")
      .join("+.*");
    const regex = new RegExp(filterString);

    nodes.createOrUpdateFilterFn("filterIdentities", (participant) =>
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
      nodes.createOrUpdateFilterFn("identityType", () => true);
    } else {
      nodes.createOrUpdateFilterFn("identityType", (participant) =>
        includedTypes.includes(participant.identity.subtype)
      );
    }
  };

  const handleChangePage = (event, newIndex) => {
    nodes.setPageIndex(newIndex);
  };

  const handleChangeRowsPerPage = (event) => {
    nodes.setRowsPerPage(Number(event.target.value));
  };

  const makeCircle = (
    value: string | number,
    title: string,
    className: string
  ) => (
    <div
      className={`${classes.centerRow} ${classes.circleWrapper} ${className}`}
    >
      <div className={`${classes.centerRow} ${classes.circle} ${className}`}>
        {value}
      </div>
      <div>{title}</div>
    </div>
  );

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
        <CredTimeline height={150} width={1000} data={credTimelineSummary} />
      </div>
      <Divider style={{margin: 20}} />
      <div className={`${classes.rightRow}`}>
        <Tabs
          className={classes.rightRow}
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, val) => setTab(val)}
        >
          <Tab label="This Week" />
          <Tab label="Last Week" />
          <Tab label="This Month" />
          <Tab label="All Time" />
        </Tabs>
      </div>
      <div className={classes.centerRow}>
        {makeCircle(
          summaryInfo[0].value,
          summaryInfo[0].title,
          classes.credCircle
        )}
        {makeCircle(
          summaryInfo[1].value,
          summaryInfo[1].title,
          classes.grainCircle
        )}
        {makeCircle(
          summaryInfo[2].value,
          summaryInfo[2].title,
          classes.participantCircle
        )}
        {makeCircle(
          summaryInfo[3].value,
          summaryInfo[3].title,
          classes.grainPerCredCircle
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
            <span style={{fontSize: "24px"}}>Last Week&apos;s Activity</span>
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
                      active={nodes.sortName === CRED_SORT.name}
                      direction={
                        nodes.sortName === CRED_SORT.name
                          ? nodes.sortOrder
                          : DEFAULT_SORT
                      }
                      onClick={() =>
                        nodes.setSortFn(CRED_SORT.name, CRED_SORT.fn)
                      }
                    >
                      <b>{CRED_SORT.name.description}</b>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={nodes.sortName === GRAIN_SORT.name}
                      direction={
                        nodes.sortName === GRAIN_SORT.name
                          ? nodes.sortOrder
                          : DEFAULT_SORT
                      }
                      onClick={() =>
                        nodes.setSortFn(GRAIN_SORT.name, GRAIN_SORT.fn)
                      }
                    >
                      <b>{GRAIN_SORT.name.description}</b>
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <b>Contributions Chart (ALL TIME)</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.username}>
                    <TableCell component="th" scope="row">
                      {row.username}
                    </TableCell>
                    <TableCell>{row.cred}</TableCell>
                    <TableCell>{row.grain}</TableCell>
                    <TableCell align="right">
                      <CredTimeline data={row.chart} />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow key="average">
                  <TableCell component="th" scope="row">
                    Average
                  </TableCell>
                  <TableCell>42</TableCell>
                  <TableCell>88.9g</TableCell>
                  <TableCell align="right" />
                </TableRow>
                <TableRow key="total">
                  <TableCell component="th" scope="row">
                    <b>TOTAL</b>
                  </TableCell>
                  <TableCell>
                    <b>610</b>
                  </TableCell>
                  <TableCell>
                    <b>2097g</b>
                  </TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TablePagination
                    rowsPerPageOptions={[
                      ...PAGINATION_OPTIONS,
                      {label: "All", value: Number.MAX_SAFE_INTEGER},
                    ]}
                    colSpan={4}
                    count={nodes.length}
                    rowsPerPage={nodes.rowsPerPage}
                    page={nodes.pageIndex}
                    SelectProps={{
                      inputProps: {"aria-label": "rows per page"},
                      native: true,
                    }}
                    onChangePage={handleChangePage}
                    onChangeRowsPerPage={handleChangeRowsPerPage}
                    // ActionsComponent={TablePaginationActions}
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
