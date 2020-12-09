import { providers } from "ethers"
import {
    XDAI_CHAIN_ID,
    XDAI_ENS_REGISTRY_ADDRESS,
    SOKOL_CHAIN_ID,
    SOKOL_ENS_REGISTRY_ADDRESS,
    XDAI_TEST_ENS_REGISTRY_ADDRESS,
    XDAI_PROVIDER_URI
} from "../constants"
import { EthNetworkID } from "../net/gateway-bootnode"

export class ProviderUtil {
    /**
     * Returns a JSON RPC provider using the given Gateway URI
     * @param uri
     */
    static fromUri(uri: string, networkId?: EthNetworkID, options: { testing: boolean } = { testing: false }) {
        switch (networkId) {
            case "xdai":
                if (options.testing) {
                    return new providers.JsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_TEST_ENS_REGISTRY_ADDRESS })
                } else {
                    return new providers.JsonRpcProvider(uri, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
                }
            case "sokol":
                return new providers.JsonRpcProvider(uri, { chainId: SOKOL_CHAIN_ID, name: "sokol", ensAddress: SOKOL_ENS_REGISTRY_ADDRESS })
            default:
                return new providers.JsonRpcProvider(uri)
        }
    }

    /**
     * Returns a signer from the web3 current provider (browser only)
     * Returns null if not available
     */
    static fromInjectedWeb3() {
        if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null
        return new providers.Web3Provider(window["web3"].currentProvider)
    }
}
