import { providers } from "ethers"

/**
 * Returns a JSON RPC provider using the given Gateway URI
 * @param uri 
 */
export function providerFromUri(uri: string) {
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
