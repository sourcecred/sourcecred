// @flow

import WalletConnectProvider from "@walletconnect/web3-provider";
import {providers} from "ethers";
import * as React from "react";
import Web3Modal from "web3modal";

const INFURA_ID = "a60f8c4d3d4a40a49c4568570a7546b7";

export type Web3ContextType = {|
  provider: providers.Web3Provider | null,
  connectWeb3: () => Promise<void>,
  disconnect: () => void,
  isConnecting: boolean,
  isConnected: boolean,
  address: string | null,
|};

export const Web3Context: React$Context<Web3ContextType> = React.createContext({
  provider: null,
  connectWeb3: async () => {},
  disconnect: () => undefined,
  isConnecting: false,
  isConnected: false,
  address: null,
});

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      infuraId: INFURA_ID,
    },
  },
};

const web3Modal =
  typeof window !== "undefined" &&
  new Web3Modal({
    network: "mainnet",
    cacheProvider: true,
    providerOptions,
  });

type Web3ContextProviderProps = {|
  +children: React.Node,
|};

export const useWeb3 = (): Web3ContextType => React.useContext(Web3Context);

export const Web3ContextProvider = ({
  children,
}: Web3ContextProviderProps): React.Node => {
  const [provider, setProvider] = React.useState<providers.Web3Provider | null>(
    null
  );
  const [isConnected, setIsConnected] = React.useState<boolean>(false);
  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  const [address, setAddress] = React.useState<string | null>(null);

  const disconnect = React.useCallback(() => {
    if (web3Modal === false) return;

    web3Modal.clearCachedProvider();
    setAddress(null);
    setProvider(null);
    setIsConnecting(false);
    setIsConnected(false);
  }, []);

  const connectWeb3 = React.useCallback(async () => {
    if (web3Modal === false) return;
    setIsConnecting(true);

    try {
      const web3Provider = await web3Modal.connect();
      const ethersProvider = new providers.Web3Provider(web3Provider);

      const ethAddress = await ethersProvider.getSigner().getAddress();

      setAddress(ethAddress);
      setProvider(ethersProvider);
      setIsConnecting(false);
      setIsConnected(true);
    } catch (error) {
      console.log(error);
      setIsConnecting(false);
      disconnect();
    }
  }, [disconnect]);

  return (
    <Web3Context.Provider
      value={{
        provider,
        connectWeb3,
        disconnect,
        isConnected,
        isConnecting,
        address,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
