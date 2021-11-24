import { Web3Provider } from "@ethersproject/providers"

export namespace SignerUtil {
    /**
     * Returns a Web3 signer if the browser supports it or if Metamask is available
     * Returns null otherwise
     */
    export function fromInjectedWeb3() {
        if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null

        const provider = new Web3Provider(window["web3"].currentProvider)
        if (!provider.getSigner) return null
        return provider.getSigner()
    }
}
