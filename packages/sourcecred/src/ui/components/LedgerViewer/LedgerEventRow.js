// @flow

import React, {type Node as ReactNode} from "react";
import {createMuiTheme, ThemeProvider} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import VisibilityIcon from "@material-ui/icons/Visibility";
import Chip from "@material-ui/core/Chip";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import {Ledger, type LedgerEvent} from "../../../core/ledger/ledger";
import {makeStyles} from "@material-ui/core/styles";
import {formatTimestamp} from "../../utils/dateHelpers";
import type {Allocation} from "../../../core/ledger/grainAllocation";
import * as G from "../../../core/ledger/grain";
import AddAlias from "./AddAlias";
import TransferGrain from "./TransferGrain";
import IdentityDetails from "./IdentityDetails";

const useStyles = makeStyles((theme) => {
  return {
    container: {
      width: "100%",
    },
    table: {
      maxHeight: "75vh",
    },
    dialog: {
      paddingTop: "0 !important",
      padding: 0,
    },
    toolbar: {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(1),
    },
    chip: {
      fontSize: "0.55rem",
      color: "#828282",
      backgroundColor: "#383838",
      textShadow: "0 1px 0 rgba(0,0,0, 0.4)",
    },
  };
});

const actionTheme = createMuiTheme({
  palette: {
    primary: {
      // light: will be calculated from palette.primary.main,
      main: "#CBDFFF",
      // dark: will be calculated from palette.primary.main,
      // contrastText: will be calculated to contrast with palette.primary.main
    },
  },
});

type LedgerEventRowProps = {|
  +event: LedgerEvent,
  +ledger: Ledger,
  +currencySuffix: string,
  +handleClickOpen: (a: Allocation) => void,
|};

type EventRow = (LedgerEventRowProps) => ReactNode;

function _friendlyFormatActionType(type: string): string {
  //Split words by _, capitalize them, and join them with " "
  var words = type.split("_");
  words.forEach((word, idx) => {
    word = word.toLowerCase();
    word = word.charAt(0).toUpperCase() + word.slice(1);
    words[idx] = word;
  });
  return words.join(" ");
}

const LedgerEventRow = (props: LedgerEventRowProps): ReactNode => {
  const classes = useStyles();
  const {action} = props.event;
  const getEventDetails = () => {
    switch (action.type) {
      case "CREATE_IDENTITY":
        return (
          <>
            <IdentityDetails
              id={action.identity.id}
              name={action.identity.name}
            />
            <Chip
              className={classes.chip}
              label={action.identity.subtype}
              size="small"
            />
          </>
        );
      case "ADD_ALIAS":
        return (
          <AddAlias action={action} ledger={props.ledger} classes={classes} />
        );
      case "TOGGLE_ACTIVATION":
        try {
          const account = props.ledger.account(action.identityId);
          return (
            <IdentityDetails
              id={account.identity.id}
              name={account.identity.name}
            />
          );
        } catch (e) {
          console.warn("Unable to find account for action: ", action);
          return (
            <IdentityDetails id={action.identityId} name="[Unknown Account]" />
          );
        }
      case "DISTRIBUTE_GRAIN":
        return action.distribution.allocations.map((a, i) => (
          <Box mr={2} key={`${a.policy.policyType}-${i}`}>
            <Chip
              label={`${a.policy.policyType}: ${G.format(
                a.policy.budget,
                0,
                props.currencySuffix
              )}`}
              clickable
              onClick={() => props.handleClickOpen(a)}
              onDelete={() => props.handleClickOpen(a)}
              size="small"
              deleteIcon={<VisibilityIcon />}
            />
          </Box>
        ));
      case "TRANSFER_GRAIN":
        return (
          <TransferGrain
            action={action}
            ledger={props.ledger}
            classes={classes}
          />
        );

      default:
        return "";
    }
  };

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        <ThemeProvider theme={actionTheme}>
          <Typography color="primary">
            {_friendlyFormatActionType(props.event.action.type)}
          </Typography>
        </ThemeProvider>
      </TableCell>
      <TableCell>
        <Box
          display="flex"
          flex={1}
          flexDirection="row"
          alignItems="center"
          flexWrap="wrap"
        >
          {getEventDetails()}
        </Box>
      </TableCell>
      <TableCell align="right">
        {formatTimestamp(props.event.ledgerTimestamp)}
      </TableCell>
    </TableRow>
  );
};

export default ((React.memo(LedgerEventRow): any): EventRow);
