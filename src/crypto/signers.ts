import { providers } from "ethers"

export namespace Web3Signer {
  /**
   * Returns a Web3 signer if the browser supports it or if Metamask is available
   * Returns null otherwise
   */
  export function fromInjected() {
    if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null

    const provider = new providers.Web3Provider(window["web3"].currentProvider)
    if (!provider?.getSigner) return null
    return provider.getSigner()
  }
}
