// @flow
import * as React from "react";
import classNames from "classnames";
import {useSelector} from "react-redux";
import makeStyles from '@mui/styles/makeStyles';
import CircularProgress from "@mui/material/CircularProgress";
import {useRefreshWhenVisible} from "ra-core";

const useStyles = makeStyles(
  {
    loader: {
      margin: 14,
    },
  },
  {name: "RaLoadingIndicator"}
);

const LoadingIndicator = (props: Props): React.Node | boolean => {
  const {classes: _ /*classesOverride*/, className} = props;
  useRefreshWhenVisible();
  const loading = useSelector((state) => state.admin.loading > 0);
  const classes = useStyles(props);
  return (
    loading && (
      <CircularProgress
        className={classNames("app-loader", classes.loader, className)}
        color="inherit"
        size={18}
        thickness={5}
      />
    )
  );
};

type Props = {
  classes?: Object,
  className?: string,
  width?: string,
};

export default LoadingIndicator;
