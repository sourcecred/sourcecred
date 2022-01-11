// @flow

import * as React from "react";
import { useWeb3 } from "./Web3Context";
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  CircularProgress
} from "@material-ui/core";
import { formatAndTrim, formatTimestamp } from "./lib";
import { Contract, BigNumber as BN } from "ethers";

type ClaimAmountProps = {|
  +handleClickFn: (...any) => any,
  +payoutDistributions: Array<Array<[string, string]>>
|};
export function OpenClaimButton({
  handleClickFn,
  payoutDistributions
}: ClaimAmountProps): React.Node {
  const { address, isConnected, provider } = useWeb3();
  const [payouts, setPayouts] = React.useState<Array<[string, string] | null>>(
    []
  );
  const [payoutSum, setPayoutSum] = React.useState<string | null>(null);

  React.useMemo(
    () => {
      if (isConnected && address != null) {
        const nextPayouts = findPayouts(payoutDistributions, address);
        const nextPayoutSum = sumPayouts(payoutDistributions, address);

        setPayoutSum(nextPayoutSum);
        setPayouts(nextPayouts);
        console.log({ nextPayouts, provider });
      }
    },
    [isConnected, payoutDistributions]
  );

  return (
    <Button onClick={handleClickFn}>
      {isConnected && address && payoutSum
        ? formatAndTrim(payoutSum, 2)
        : "no payouts"}
    </Button>
  );
}

const findPayouts = (
  payoutDistributions: Array<Array<[string, string]>>,
  userAddress: string
): Array<[string, string] | null> => {
  return payoutDistributions.map((distro: Array<[string, string]>) => {
    const element = distro.find(
      ([address, amount]) => address.toLowerCase() === userAddress.toLowerCase()
    );
    if (!element) return null;
    return element;
  });
};

const sumPayouts = (
  payoutDistributions: Array<Array<[string, string]>>,
  userAddress: string
): string => {
  return findPayouts(payoutDistributions, userAddress)
    .map((element: [string, string] | null) => {
      if (!element) return BN.from(0);
      const [_, amountString] = element;

      return BN.from(amountString);
    })
    .reduce((acc, val) => acc.add(val))
    .toString();
};
