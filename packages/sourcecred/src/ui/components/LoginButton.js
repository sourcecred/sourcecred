// @flow
import * as React from "react";
import {Button, CircularProgress} from "@material-ui/core";
import {useWeb3} from "../utils/Web3Context";
import {
  parseAddress,
  truncateEthAddress,
} from "../../plugins/ethereum/ethAddress";

export const LoginButton = (): React.Node => {
  const {address, connectWeb3, disconnect, isConnected, isConnecting} =
    useWeb3();

  const handleLoginClick = React.useCallback(async () => {
    await connectWeb3();
  }, [connectWeb3]);

  if (isConnecting) {
    return <CircularProgress color={"secondary"} />;
  }

  return (
    <Button onClick={isConnected ? disconnect : handleLoginClick}>
      {isConnected && address
        ? `Disconnect ${truncateEthAddress(parseAddress(address))}`
        : "Connect"}
    </Button>
  );
};
