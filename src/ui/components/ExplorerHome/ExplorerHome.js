// @flow
import React, {useState, type Node as ReactNode} from "react";
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
  TableHead,
  TableRow,
  TextField,
} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {CredGrainView} from "../../../core/credGrainView";
import sortBy from "../../../util/sortBy";
import CredTimeline from "./CredTimeline";

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
  tableWrapper: {flexGrow: 3, flexBasis: 0, margin: "20px"},
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
}));

type ExplorerHomeProps = {|
  +initialView: CredGrainView | null,
|};

export const ExplorerHome = ({initialView}: ExplorerHomeProps): ReactNode => {
  if (!initialView) return null;

  const classes = useStyles();
  const [tab, setTab] = useState<number>(1);
  const [checkboxes, setCheckboxes] = useState({
    participants: false,
    organizations: false,
    bots: false,
    projects: false,
  });
  const {participants, organizations, bots, projects} = checkboxes;

  const handleChange = (event) => {
    setCheckboxes({...checkboxes, [event.target.name]: event.target.checked});
  };

  const data = [
    {title: "Cred This Week", value: 610},
    {title: "Grain Harvested", value: "6,765g"},
    {title: "Active Participants", value: 13},
    {title: "Grain per Cred", value: "22g"},
  ];

  const createData = (username, cred, grain, chart) => ({
    username,
    cred,
    grain,
    chart,
  });

  // sort by cred amount, highest to lowest
  const nodes = sortBy(initialView.participants(), (n) => -n.cred);
  // create an array of 0s for the cred summary graph at the top of the page
  let credTimelineSummary = initialView.intervals().map(() => 0);

  const rows = nodes.map((node) => {
    const {credPerInterval} = node;

    // add this node's cred to the summary graph
    credTimelineSummary = credTimelineSummary.map(
      (total, i) => credPerInterval[i] + total
    );

    return createData(
      node.identity.name,
      node.cred,
      node.grainEarned,
      credPerInterval
    );
  });

  const makeCircle = (
    value: string | number,
    title: string,
    borderColor: string
  ) => (
    <div
      className={`${classes.centerRow} ${classes.circleWrapper}`}
      style={{color: borderColor}}
    >
      <div
        className={`${classes.centerRow} ${classes.circle}`}
        style={{borderColor}}
      >
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
        {makeCircle(data[0].value, data[0].title, "#6174CC")}
        {makeCircle(data[1].value, data[1].title, "#FFAA3D")}
        {makeCircle(data[2].value, data[2].title, "#FDBBD1")}
        {makeCircle(data[3].value, data[3].title, "#4BD76D")}
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
            <TextField label="Filter Names" variant="outlined" />
          </div>
          <TableContainer component={Paper}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <b>Participant</b>
                  </TableCell>
                  <TableCell>
                    <b>Cred</b>
                  </TableCell>
                  <TableCell>
                    <b>Grain</b>
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
            </Table>
          </TableContainer>
          <FormGroup row className={classes.rightRow}>
            <FormLabel className={classes.checklabel} component="legend">
              SHOW:
            </FormLabel>
            <FormControlLabel
              control={
                <Checkbox
                  checked={participants}
                  onChange={handleChange}
                  name="participants"
                />
              }
              label="Participants"
            />
            <FormControlLabel
              control={
                <Checkbox checked={bots} onChange={handleChange} name="bots" />
              }
              label="Bots"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={projects}
                  onChange={handleChange}
                  name="projects"
                />
              }
              label="Projects"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={organizations}
                  onChange={handleChange}
                  name="organizations"
                />
              }
              label="Organizations"
            />
          </FormGroup>
        </div>
        <div
          className={classes.barChartWrapper}
          style={{flexDirection: "column"}}
        >
          <h2>Cred By Plugin</h2>
          <div className={classes.barChart}>Bar Chart</div>
        </div>
      </div>
    </Container>
  );
};
