// @flow

import React, {type Node as ReactNode} from "react";
import {TextField, Link} from "@material-ui/core";

const changePayoutAddressHook = (setStateFn: (string) => void) => (
  event: SyntheticInputEvent<HTMLInputElement>
) => setStateFn(event.currentTarget.value);

type Props = {|
  +nextPayoutAddress: string,
  +setPayoutAddress: (string) => void,
  +error: boolean,
|};

export function PayableAddressView({
  nextPayoutAddress,
  setPayoutAddress,
  error,
}: Props): ReactNode {
  const changePayoutAddress = changePayoutAddressHook(setPayoutAddress);
  const helperText = error ? "Invalid Eth Address" : null;
  const etherscanLink = `https://etherscan.io/address/${nextPayoutAddress.toLowerCase()}`;
  return (
    <div>
      <h3>Payout Address</h3>
      <TextField
        fullWidth
        error={error}
        helperText={helperText}
        variant="outlined"
        type="text"
        label="Add Payout Address"
        onChange={changePayoutAddress}
        value={nextPayoutAddress}
      />
      {!error && nextPayoutAddress !== "" && (
        <p>
          <Link target="_blank" rel="noreferrer" href={etherscanLink}>
            View on Etherscan
          </Link>
        </p>
      )}
    </div>
  );
}
