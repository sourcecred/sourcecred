// @flow
import React, {useState, type Node as ReactNode} from "react";
import {Button, Container, TextField, useMediaQuery} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
import {div, format, gt, lt, fromFloatString} from "../../core/ledger/grain";
import {type Account} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../../api/currencyConfig";
import AccountDropdown from "./AccountSelector";
import {useLedger} from "../utils/LedgerContext";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "80%",
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
    width: "200px",
  },
  saveToLedgerAlert: {
    textAlign: "right",
    marginRight: "24px",
  },
  triangle: {
    width: 0,
    height: 0,
    top: "100%",
    background: theme.palette.background,
    borderTop: "30px solid transparent",
    borderBottom: "30px solid transparent",
    borderLeft: `30px solid ${theme.palette.background.paper}`,
  },
  downArrow: {
    flexDirection: "column",
    "&:after": {
      content: '""',
      display: "block",
      background: theme.palette.background,
      borderTop: `20px solid ${theme.palette.background.paper}`,
      borderRight: "120px solid transparent",
      borderLeft: "120px solid transparent",
    },
  },
  dropdownWrapper: {
    border: `1px solid ${theme.palette.text.primary}`,
    borderRadius: "50px",
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  verticalElementMobileLayout: {
    display: "flex",
    flexDirection: "column",
    alignItems: "inherit",
  },
  rootMobileLayout: {
    margin: "0 auto",
    padding: "0 1em 1em",
  },
  saveButtonContainer: {
    display: "flex",
    flexDirection: "column",
  },
  element: {flex: 1, margin: "20px"},
  arrowInput: {width: "40%", display: "inline-block"},
  pageHeader: {color: theme.palette.text.primary},
}));

type TransferProps = {|+currency: CurrencyDetails|};

export const Transfer = ({
  currency: {name: currencyName, suffix: currencySuffix},
}: TransferProps): ReactNode => {
  const {ledger, updateLedger, saveToDisk} = useLedger();

  const classes = useStyles();
  const [sender, setSender] = useState<Account | null>(null);
  const [receiver, setReceiver] = useState<Account | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [isSavedToLedger, setIsSavedToLedger] = useState<boolean>(false);
  const isXSmall = useMediaQuery((theme) => theme.breakpoints.down("xs"));

  const isDisabled =
    !Number(amount) ||
    !(sender && receiver) ||
    gt(fromFloatString(amount), sender.balance) ||
    lt(fromFloatString(amount), fromFloatString("0"));

  const submitTransfer = () => {
    if (sender && receiver) {
      const nextLedger = ledger.transferGrain({
        from: sender.identity.id,
        to: receiver.identity.id,
        amount: fromFloatString(amount),
        memo: memo,
      });
      updateLedger(nextLedger);
      setAmount("");
      setIsSavedToLedger(!isSavedToLedger);
      setSender(nextLedger.account(sender.identity.id));
      setReceiver(nextLedger.account(receiver.identity.id));
      setMemo("");
    }
  };

  const handleSaveToDisk = () => {
    setIsSavedToLedger(!isSavedToLedger);
    saveToDisk();
    setMemo("");
    setReceiver(null);
    setSender(null);
    setAmount("");
  };

  const handleSaveToLedgerWarning = (_) => {
    if (
      isSavedToLedger || 
      sender !== null ||
      receiver !== null ||
      amount !== ""
    ) {
      return (
        <div className={classes.saveToLedgerAlert}>
          Changes not saved to ledger
        </div>
      );
    }
  };

  return (
    <Container
      className={`${isXSmall ? classes.rootMobileLayout : classes.root}`}
    >
      <h1 className={`${classes.centerRow} ${classes.pageHeader}`}>
        Transfer {`${currencyName}`}
      </h1>
      <div
        className={`${classes.centerRow} ${
          isXSmall ? classes.verticalElementMobileLayout : ""
        }`}
      >
        <div
          className={`${classes.dropdownWrapper} ${classes.centerRow} ${classes.element}`}
        >
          <AccountDropdown
            ledger={ledger}
            setCurrentAccount={setSender}
            placeholder="From..."
          />
        </div>
        <div
          className={`${classes.centerRow} ${classes.element} ${
            isXSmall
              ? classes.verticalElementMobileLayout && classes.downArrow
              : ""
          }`}
        >
          <div className={classes.arrowBody}>
            <TextField
              className={classes.arrowInput}
              size="medium"
              InputProps={{disableUnderline: true}}
              type="number"
              placeholder="(amount)"
              value={amount}
              onChange={(e) => setAmount(e.currentTarget.value)}
            />
            <span>
              {sender && ` max: ${format(sender.balance, 2, currencySuffix)}`}
            </span>
          </div>
          <div className={`${isXSmall ? "" : classes.triangle}`} />
        </div>
        <div
          className={`${classes.dropdownWrapper} ${classes.centerRow} ${classes.element}`}
        >
          <AccountDropdown
            ledger={ledger}
            setCurrentAccount={setReceiver}
            placeholder="To..."
          />
        </div>
      </div>
      <div
        className={`${classes.centerRow} ${
          isXSmall ? classes.verticalElementMobileLayout : ""
        }`}
      >
        <TextField
          variant="outlined"
          size="medium"
          className={classes.element}
          type="text"
          value={memo}
          placeholder="Memo"
          onChange={(e) => setMemo(e.currentTarget.value)}
        />
      </div>
      {handleSaveToLedgerWarning()}
      <div
        className={`${classes.centerRow} ${
          isXSmall ? classes.verticalElementMobileLayout : ""
        }`}
      >
        <Button
          size="large"
          color="primary"
          variant="contained"
          className={classes.element}
          disabled={isDisabled}
          onClick={submitTransfer}
        >
          transfer grain
        </Button>
        <div>
          <Button
            size="large"
            color="primary"
            variant="contained"
            className={classes.element}
            onClick={handleSaveToDisk}
            disabled={!isSavedToLedger}
          >
            save ledger to disk
          </Button>
        </div>
      </div>
    </Container>
  );
};
