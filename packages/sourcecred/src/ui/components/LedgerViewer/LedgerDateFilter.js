import React from "react";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import {KeyboardDatePicker} from "@material-ui/pickers";
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
  +startDateFilter: Date,
  +endDateFilter: Date,
  handleChangeStartDate: (date) => void,
  handleChangeEndDate: (date) => void,
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
      <div className={classes.pickerContainer}>
        <KeyboardDatePicker
          format="MM/dd/yyyy"
          label="Start Date"
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
            color="secondary"
            className={classes.clearButton}
          >
            <span className={classes.clearButtonText}>Clear</span>
            <ClearIcon color="secondary" fontSize="small" />
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
            color="secondary"
            className={classes.clearButton}
          >
            <span className={classes.clearButtonText}>Clear</span>
            <ClearIcon color="secondary" fontSize="small" />
          </IconButton>
        )}
      </div>
    </Grid>
  );
};
