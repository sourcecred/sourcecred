// @flow

import * as React from "react";
import {Children} from "react";
import {useDispatch} from "react-redux";
import classNames from "classnames";
import {
  AppBar as MuiAppBar,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@material-ui/core";

import {makeStyles} from "@material-ui/core/styles";
import MenuIcon from "@material-ui/icons/Menu";
import {toggleSidebar, useTranslate} from "ra-core";
import {HideOnScroll} from "ra-ui-materialui";

import LoadingIndicator from "./LoadingIndicator";
import {LoginButton} from "./LoginButton";

const useStyles = makeStyles(
  (theme) => ({
    toolbar: {
      paddingRight: 24,
      backgroundColor: theme.palette.primary.dark,
    },
    menuButton: {
      marginLeft: "4px",
      marginRight: "16px",
    },
    menuButtonIconClosed: {
      transition: theme.transitions.create(["transform"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      transform: "rotate(0deg)",
    },
    menuButtonIconOpen: {
      transition: theme.transitions.create(["transform"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      transform: "rotate(180deg)",
    },
    title: {
      flex: 1,
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      overflow: "hidden",
    },
  }),
  {name: "RaAppBar"}
);

type Props = {
  children: React.Node,
  classes: Object,
  className: string,
  color: "default" | "inherit" | "primary" | "transparent",
  open: boolean,
  isDev: boolean,
};

/**
 * The AppBar component renders a custom MuiAppBar.
 *
 * @param {ReactNode} children React node/s to be render as children of the AppBar
 * @param {Object} classes CSS class names
 * @param {string} className CSS class applied to the MuiAppBar component
 * @param {string} color The color of the AppBar
 * @param {Component} logout The logout button component that will be pass to the UserMenu component
 * @param {boolean} open State of the <Admin/> Sidebar
 * @param {Element} userMenu A custom user menu component for the AppBar. <UserMenu/> component by default
 *
 * @example
 *
 * const MyAppBar = props => {
 *   const classes = useStyles();
 *   return (
 *       <AppBar {...props}>
 *           <Typography
 *               variant="h6"
 *               color="inherit"
 *               className={classes.title}
 *               id="react-admin-title"
 *           />
 *        </AppBar>
 *    );
 *};
 */
const AppBar = (props: Props): React.Node => {
  const {
    children,
    classes: _ /*classesOverride*/,
    className,
    color = "primary",
    isDev,
    /*logo*/
    open,
    /*title*/
  } = props;
  const classes = useStyles(props);
  const dispatch = useDispatch();
  const isXSmall = useMediaQuery((theme) => theme.breakpoints.down("xs"));
  const translate = useTranslate();

  return (
    <HideOnScroll>
      <MuiAppBar className={className} color={color}>
        <Toolbar
          disableGutters
          variant={isXSmall ? "regular" : "dense"}
          className={classes.toolbar}
        >
          <Tooltip
            title={translate(
              open ? "ra.action.close_menu" : "ra.action.open_menu",
              {
                _: "Open/Close menu",
              }
            )}
            enterDelay={500}
          >
            <IconButton
              color="default"
              onClick={() => dispatch(toggleSidebar())}
              className={classNames(classes.menuButton)}
            >
              <MenuIcon
                classes={{
                  root: open
                    ? classes.menuButtonIconOpen
                    : classes.menuButtonIconClosed,
                }}
              />
            </IconButton>
          </Tooltip>
          {Children.count(children) === 0 ? (
            <Typography
              variant="h6"
              color="inherit"
              className={classes.title}
              id="react-admin-title"
            />
          ) : (
            children
          )}
          <LoadingIndicator />
          {isDev ? <LoginButton /> : null}
        </Toolbar>
      </MuiAppBar>
    </HideOnScroll>
  );
};

export default AppBar;
