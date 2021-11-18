// @flow

import React, {type Node as ReactNode} from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import DatePicker from '@mui/lab/DatePicker';
import {makeStyles} from "@material-ui/core/styles";

const MAX_FILTER_DATE = new Date();

const useStyles = makeStyles(() => ({
  pickersGrid: {
    marginBottom: 10,
    justifyContent: "flex-end",
  },
  pickerContainer: {
    position: "relative",
  },
  clearButton: {
    position: "absolute",
    top: -20,
    right: -3,
  },
  clearButtonText: {
    fontSize: 15,
  },
}));

type LedgerDateFilterProps = {|
  +startDateFilter: Date | null,
  +endDateFilter: Date | null,
  handleChangeStartDate: (date: Date | null) => void,
  handleChangeEndDate: (date: Date | null) => void,
  handleClearEndDate: () => void,
  handleClearStartDate: () => void,
|};

export const LedgerDateFilter = (props: LedgerDateFilterProps): ReactNode => {
  const classes = useStyles();
  const {
    startDateFilter,
    endDateFilter,
    handleChangeStartDate,
    handleChangeEndDate,
    handleClearEndDate,
    handleClearStartDate,
  } = props;
  return (
    <Grid container className={classes.pickersGrid} spacing={2}>
    
      {/* https://mui.com/guides/pickers-migration/
      <div className={classes.pickerContainer}>
        <DatePicker
          inputFormat="MM/dd/yyyy"
          renderInput={props => <TextField label="Start Date" />}
          value={startDateFilter}
          onChange={handleChangeStartDate}
          KeyboardButtonProps={{
            "aria-label": "change start date",
          }}
          maxDate={MAX_FILTER_DATE}
        />
        {startDateFilter && (
          <IconButton
            onClick={handleClearStartDate}
            disabled={!startDateFilter}
            color="primary"
            className={classes.clearButton}
          >
            <span className={classes.clearButtonText}>Clear</span>
            <ClearIcon color="primary" fontSize="small" />
          </IconButton>
        )}
      </div>
      <div style={{position: "relative"}}>
        <KeyboardDatePicker
          label="End Date"
          format="MM/dd/yyyy"
          value={endDateFilter}
          onChange={handleChangeEndDate}
          maxDate={MAX_FILTER_DATE}
          KeyboardButtonProps={{
            "aria-label": "change end date",
          }}
        />
        {endDateFilter && (
          <IconButton
            onClick={handleClearEndDate}
            disabled={!endDateFilter}
            color="primary"
            className={classes.clearButton}
          >
            <span className={classes.clearButtonText}>Clear</span>
            <ClearIcon color="primary" fontSize="small" />
          </IconButton>
        )}
      </div> */}
    </Grid>
  );
};
