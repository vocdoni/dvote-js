import { StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers"
import {
    EthNetworkID,
    VocdoniEnvironment,
    XDAI_CHAIN_ID,
    XDAI_ENS_REGISTRY_ADDRESS,
    SOKOL_CHAIN_ID,
    SOKOL_ENS_REGISTRY_ADDRESS,
    XDAI_STG_ENS_REGISTRY_ADDRESS,
    // MUMBAI_CHAIN_ID,
    MATIC_CHAIN_ID,
    MATIC_ENS_REGISTRY_ADDRESS,
    // MUMBAI_ENS_REGISTRY_ADDRESS
} from "@vocdoni/common"

export class ProviderUtil {
    /**
     * Returns a JSON RPC provider using the given Gateway URI
     * @param uri
     */
    static fromUri(uri: string, networkId?: EthNetworkID, environment: VocdoniEnvironment = 'prod') {
        switch (networkId) {
            case "xdai":
                if (environment === 'prod')
                    return new StaticJsonRpcProvider(uri, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
                return new StaticJsonRpcProvider(uri, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_STG_ENS_REGISTRY_ADDRESS })
            case "sokol":
                return new StaticJsonRpcProvider(uri, { chainId: SOKOL_CHAIN_ID, name: "sokol", ensAddress: SOKOL_ENS_REGISTRY_ADDRESS })
            case "matic":
                return new StaticJsonRpcProvider(uri, { chainId: MATIC_CHAIN_ID, name: "matic", ensAddress: MATIC_ENS_REGISTRY_ADDRESS })
            case "mumbai":
                // return new StaticJsonRpcProvider(uri, { chainId: MUMBAI_CHAIN_ID, name: "mumbai", ensAddress: MUMBAI_ENS_REGISTRY_ADDRESS })
                throw new Error("Unsupported Network ID")
            default:
                return new StaticJsonRpcProvider(uri)
        }
    }

    /**
     * Returns a signer from the web3 current provider (browser only)
     * Returns null if not available
     */
    static fromInjectedWeb3() {
        if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null
        return new Web3Provider(window["web3"].currentProvider)
    }
}
