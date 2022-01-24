import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { providers } from "ethers";
import Web3Modal, { IProviderOptions } from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";

const DEFAULT_CHAIN_ID = 1;
// const INFURA_ID = "1234...";

const providerOptions: IProviderOptions = {
  // metamask: {},
  // walletconnect: {
  //   package: WalletConnectProvider,
  //   options: {
  //     infuraId: INFURA_ID,
  //   },
  // },
};

// Context

type SignerValue = {
  provider: providers.Web3Provider;
  signer: providers.JsonRpcSigner;
  status: "disconnected" | "connecting" | "connected";
  address: string;
  chainId: number;
  methods: {
    selectWallet: () => Promise<void>;
    refreshChainId: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
};
const SignerContext = createContext<SignerValue>(null);

export function UseSignerProvider({ children }: { children: ReactNode }) {
  const [instance, setInstance] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);

  /** Opens the Web3 pop up. Throws an Error if something fails. */
  const selectWallet = () => {
    const web3Modal = new Web3Modal({
      // network: "mainnet", // optional
      // cacheProvider: true, // optional
      providerOptions, // required
    });

    setConnecting(true);

    return web3Modal
      .connect()
      .then((instance) => {
        setInstance(instance);

        return new providers.Web3Provider(instance).getSigner().getChainId();
      })
      .then((chainId) => {
        setChainId(chainId);
        setConnecting(false);
        setConnected(true);
      })
      .catch((err) => {
        setConnecting(false);
        throw err;
      });
  };

  const disconnect = () => {
    setInstance(null);
    setConnected(false);
    setConnecting(false);
    setAddress("");
    // setChainId(DEFAULT_CHAIN_ID);

    const provider = new providers.Web3Provider(instance)
      .provider as WalletConnectProvider;
    if (!provider.isWalletConnect) {
      return Promise.resolve();
    }
    return provider.close?.();
  };

  const refreshChainId = () => {
    if (!instance) {
      // setChainId(DEFAULT_CHAIN_ID);
      return Promise.resolve();
    }

    return new providers.Web3Provider(instance)
      .getSigner()
      .getChainId()
      .then((chainId) => setChainId(chainId));
  };

  useEffect(() => {
    if (!instance) {
      if (connected) setConnected(false);
      return;
    }

    instance.on("accountsChanged", (accounts: string[]) => {
      // Return the new address
      setAddress(accounts[0]);
    });

    // chainId is a hex string
    instance.on("chainChanged", (chainId: string) => {
      refreshChainId();
    });

    // chainId is a hex string
    instance.on("connect", (info: { chainId: number }) => {
      setConnected(true);
      refreshChainId();
    });

    instance.on("disconnect", (error: { code: number; message: string }) => {
      console.log(error);
      setAddress("");
      // setChainId(DEFAULT_CHAIN_ID);
      setConnected(false);
    });

    // Update address
    new providers.Web3Provider(instance)
      .getSigner()
      .getAddress()
      .then((address: string) => setAddress(address));

    return () => {
      instance?.removeAllListeners?.();
    };
  }, [instance]);

  const provider = instance ? new providers.Web3Provider(instance) : null;
  const signer: providers.JsonRpcSigner = provider
    ? provider.getSigner()
    : null;

  let status: "disconnected" | "connecting" | "connected" = "disconnected";
  if (connecting) status = "connecting";
  else if (connected) status = "connected";

  // VALUE
  const value: SignerValue = {
    status,
    provider,
    signer,
    address,
    chainId,
    methods: {
      selectWallet,
      refreshChainId,
      disconnect,
    },
  };

  return (
    <SignerContext.Provider value={value}>{children}</SignerContext.Provider>
  );
}

export function useSigner() {
  return useContext(SignerContext);
}
