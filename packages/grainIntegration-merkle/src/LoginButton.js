// @flow
import * as React from "react";
import { Button, CircularProgress } from "@material-ui/core";
import { useWeb3 } from "./Web3Context";

export const LoginButton = (): React.Node => {
  const {
    address,
    connectWeb3,
    disconnect,
    isConnected,
    isConnecting
  } = useWeb3();

  const handleLoginClick = React.useCallback(
    async () => {
      await connectWeb3();
    },
    [connectWeb3]
  );

  if (isConnecting) {
    return <CircularProgress color={"secondary"} />;
  }

  return (
    <Button onClick={isConnected ? disconnect : handleLoginClick}>
      {isConnected && address ? `Disconnect ${address}` : "Connect"}
    </Button>
  );
};
