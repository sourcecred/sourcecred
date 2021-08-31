// @flow
import React, {type Node as ReactNode} from "react";
import {makeStyles} from "@material-ui/core/styles";
import {TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";
import {Ledger, type Account} from "../../core/ledger/ledger";

type DropdownProps = {|
  +ledger: Ledger,
  +setCurrentAccount: (Account | null) => void,
  +placeholder?: string,
  +currentAccount: Account | null,
|};

const useStyles = makeStyles({combobox: {margin: "0px 32px 16px"}});

export default function AccountDropdown({
  placeholder,
  setCurrentAccount,
  ledger,
  currentAccount,
}: DropdownProps): ReactNode {
  const classes = useStyles();
  const items = ledger.accounts().filter((a) => a.active);

  return (
    <Autocomplete
      value={currentAccount}
      size="medium"
      className={classes.combobox}
      onChange={(...args) => {
        const [, inputObj] = args;
        setCurrentAccount(inputObj);
      }}
      fullWidth
      options={items}
      getOptionLabel={(item: Account) => item.identity.name}
      renderInput={(params) => (
        <TextField
          size="large"
          fullWidth
          {...params}
          InputProps={{...params.InputProps, disableUnderline: true}}
          label={placeholder}
        />
      )}
    />
  );
}
