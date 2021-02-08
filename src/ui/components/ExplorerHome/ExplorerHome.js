// @flow
import React, {useState} from "react";
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
import {makeStyles, withStyles} from "@material-ui/core/styles";
import {CredView} from "../../../analysis/credView";
import sortBy from "../../../util/sortBy";
import CredTimeline from "./CredTimeline";
import MultiTimeline from "./MultiTimeline";

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
  legendWrapper: {
    margin: "13px",
  },
  legendSquare: {
    display: 'inline-block',
    height: '1em',
    width: '1em',
    margin: '0.5em'
  },
  leftRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  rightRow: {
    display: "flex",
    flexGrow: 1,
    flexBasis: 0,
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

const StyledTableCell = withStyles((theme) => ({
  head: {
    backgroundColor: theme.palette.common.black,
  },
  body: {
    backgroundColor: theme.palette.common.black,
    fontSize: 14,
  },
}))(TableCell);

type ExplorerHomeProps = {|
  +initialView: CredView,
|};

// dummy data:
const circleData = [
  {title: "Cred This Week", value: 610},
  {title: "Grain Harvested", value: "6,765g"},
  // TODO: add active participants later when we have data
  // {title: "Active Participants", value: 13},
  {title: "Grain per Cred", value: "22g"},
];

// TODO: Add Bar chart for cred by plugin at a later date:
/* const makeBarChart = () => {
  const margin = 60;
  const width = 1000 - 2 * margin;
  const height = 600 - 2 * margin;

  const svg = d3.select('svg');
  const chart = svg.append('g')
  .attr('transform', `translate(${margin}, ${margin})`);
} */

export const ExplorerHome = ({initialView}: ExplorerHomeProps) => {
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

  const makeCircle = (
    value: string | number,
    title: string,
    color: string
  ) => (
    <div
      className={`${classes.centerRow} ${classes.circleWrapper}`}
      style={{color}}
    >
      <div
        className={`${classes.centerRow} ${classes.circle}`}
        style={{borderColor: color, color}}
      >
        {value}
      </div>
      <div>{title}</div>
    </div>
  );

  const makeLegend = (
    name: string,
    color: string
  ) => (
    <div
      className={`${classes.leftRow} ${classes.legendWrapper}`}
      style={{ alignSelf: 'flex-start'}}
    >
      <div className={classes.legendSquare} style={{ backgroundColor: color }}></div>
      <div className={classes.centerRow}>{name}</div>
    </div>
  );

  const nodes = initialView.userNodes();
  // TODO: Allow sorting/displaying only recent cred...
  const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
  const credTimelines = sortedNodes.map((node) =>
    node.credOverTime === null ? null : node.credOverTime.cred
  );

  // dummy data:
  const rows = [
    { username: "Frozen yoghurt", cred: 159, grain: 6.0, chart: credTimelines[1] },
    { username: "Ice cream sandwich", cred: 237, grain: 9.0, chart: credTimelines[2] },
    { username: "Eclair", cred: 262, grain: 16.0, chart: credTimelines[3] },
    { username: "Cupcake", cred: 305, grain: 3.7, chart: credTimelines[4] },
    { username: "Gingerbread", cred: 356, grain: 16.0, chart: credTimelines[5] },
  ];

  return (
    <Container className={classes.root}>
      <h1 className={`${classes.centerRow} ${classes.pageHeader}`}>
        Explorer Home
      </h1>
      <div className={`${classes.centerRow} ${classes.graph}`}>
        <MultiTimeline height={150} width={1000} cred={credTimelines[0]} grain={credTimelines[1]}/>
      </div>
      <Divider style={{margin: 20}} />
      <div style={{ display: "flex"}}>
        <div className={classes.leftRow}>
          {makeLegend('cred', '#6174CC')}
          {makeLegend('grain', '#FFAA3D')}
        </div>
        <div style={{ flexGrow: 3, flexBasis: 0}}></div>
        <div className={classes.rightRow}>
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
      </div>
      <div className={classes.centerRow}>
        {makeCircle(circleData[0].value, circleData[0].title, "#6174CC")}
        {makeCircle(circleData[1].value, circleData[1].title, "#FFAA3D")}
        {makeCircle(circleData[2].value, circleData[2].title, "#4BD76D")}
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
            <span style={{fontSize: "24px"}}>Last Week's Activity</span>
            <TextField label="Filter Names" variant="outlined" />
          </div>
          <TableContainer component={Paper}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <StyledTableCell>
                    <b>Participant</b>
                  </StyledTableCell>
                  <StyledTableCell>
                    <b>Cred</b>
                  </StyledTableCell>
                  <StyledTableCell>
                    <b>Grain</b>
                  </StyledTableCell>
                  <StyledTableCell>
                    <b>Contributions Chart (All Time)</b>
                  </StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.username}>
                    <StyledTableCell component="th" scope="row">
                      {row.username}
                    </StyledTableCell>
                    <StyledTableCell>{row.cred}</StyledTableCell>
                    <StyledTableCell>{row.grain}</StyledTableCell>
                    <StyledTableCell align="right">
                      <CredTimeline data={row.chart} />
                    </StyledTableCell>
                  </TableRow>
                ))}
                <TableRow key="average">
                  <StyledTableCell component="th" scope="row">
                    Average
                  </StyledTableCell>
                  <StyledTableCell>42</StyledTableCell>
                  <StyledTableCell>88.9g</StyledTableCell>
                  <StyledTableCell align="right" />
                </TableRow>
                <TableRow key="total">
                  <StyledTableCell component="th" scope="row">
                    <b>TOTAL</b>
                  </StyledTableCell>
                  <StyledTableCell>
                    <b>610</b>
                  </StyledTableCell>
                  <StyledTableCell>
                    <b>2097g</b>
                  </StyledTableCell>
                  <StyledTableCell align="right" />
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
        {/* <div
          className={classes.barChartWrapper}
          style={{flexDirection: "column"}}
        >
          <h2>Cred By Plugin</h2>
          <div className={classes.barChart}>Bar Chart</div>
        </div> */}
      </div>
    </Container>
  );
};
