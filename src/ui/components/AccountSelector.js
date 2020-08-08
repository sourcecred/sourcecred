// @flow

import React, {useState} from "react";
import {createMuiTheme, ThemeProvider} from "@material-ui/core/styles";
import {TextField} from "@material-ui/core";
import {format, fromInteger} from "../../ledger/grain";
import {Autocomplete} from "@material-ui/lab";
import {Ledger, type Account} from "../../ledger/ledger";

type DropdownProps = {|
  +ledger: Ledger,
  +setCurrentIdentity: (Account | null) => void,
  +placeholder?: string,
|};

const theme = createMuiTheme({
  overrides: {
    text: {
      color: "black",
    },
  },
});

export default function AccountDropdown({
  placeholder,
  setCurrentIdentity,
  ledger,
}: DropdownProps) {
  const items = ledger.accounts().filter((a) => a.active);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const onComboChange = (e, inputObj) => {
    setSelectedAccount(inputObj);
    setCurrentIdentity(inputObj);
  };

  const renderInput = (params) => {
    const name = selectedAccount ? selectedAccount.identity.name : "";
    const balStr = selectedAccount
      ? ` (${format(selectedAccount.balance, 2)})`
      : "";
    return (
      <TextField
        fullWidth
        {...params}
        inputProps={{...params.inputProps, value: `${name}${balStr}`}}
        label={placeholder}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <Autocomplete
        onChange={onComboChange}
        fullWidth
        options={items}
        getOptionLabel={(item: Account) => {
          const balStr = format(
            selectedAccount && selectedAccount.balance !== fromInteger(0)
              ? selectedAccount.balance
              : item.balance,
            2
          );
          return `${item.identity.name} (${balStr})`;
        }}
        style={{margin: "20px", marginTop: "-16px"}}
        renderInput={renderInput}
      />
    </ThemeProvider>
  );
}
