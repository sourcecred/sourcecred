// @flow

import React from "react";
import {createMuiTheme, ThemeProvider} from "@material-ui/core/styles";
import {TextField} from "@material-ui/core";
import {format} from "../../ledger/grain";
import {Autocomplete} from "@material-ui/lab";
import {Ledger, type Account} from "../../ledger/ledger";

type DropdownProps = {|
  +ledger: Ledger,
  +setCurrentIdentity: (Account | null) => void,
  +placeholder?: string,
  +disableUnderline?: boolean,
|};

const theme = createMuiTheme({
  overrides: {
    // Name of the rule
    text: {
      // Some CSS
      color: "black",
    },
  },
});

export default function AccountDropdown({
  placeholder,
  setCurrentIdentity,
  ledger,
  disableUnderline,
}: DropdownProps) {
  const items = ledger.accounts().filter((a) => a.active);

  const onComboChange = (e, inputObj) => setCurrentIdentity(inputObj);

  return (
    <ThemeProvider theme={theme}>
      <Autocomplete
        onChange={onComboChange}
        fullWidth
        options={items}
        getOptionLabel={(item) =>
          `${item.identity.name} (${format(item.balance, 2)})`
        }
        style={{margin: "20px", marginTop: "-16px"}}
        style={{margin: "20px"}}
        renderInput={(params) => (
          <TextField fullWidth {...params} label={placeholder} />
        )}
      />
    </ThemeProvider>
  );
}
