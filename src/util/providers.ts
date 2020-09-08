import { providers } from "ethers"
import { XDAI_CHAIN_ID, XDAI_ENS_REGISTRY_ADDRESS, SOKOL_CHAIN_ID, SOKOL_ENS_REGISTRY_ADDRESS } from "../constants"
import { NetworkID } from "../net/gateway-bootnodes"

/**
 * Returns a JSON RPC provider using the given Gateway URI
 * @param uri
 */
export function providerFromUri(uri: string, networkId?: NetworkID) {
    if (networkId == "xdai")
        return new providers.JsonRpcProvider(uri, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
    else if (networkId == "sokol")
        return new providers.JsonRpcProvider(uri, { chainId: SOKOL_CHAIN_ID, name: "xdai", ensAddress: SOKOL_ENS_REGISTRY_ADDRESS })
    else
        return new providers.JsonRpcProvider(uri)
}

/**
 * Returns a signer from the web3 current provider (browser only)
 * Returns null if not available
 */
export function providerFromBrowserProvider() {
    if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null
    return new providers.Web3Provider(window["web3"].currentProvider)
}
