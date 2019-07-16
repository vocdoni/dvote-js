import { providers, Wallet } from "ethers"

/**
 * Returns an Ethers.js wallet and connects it to the given provider if one is set
 * @param mnemonic 
 * @param mnemonicPath (optional)
 * @param provider (optional)
 */
export function walletFromMnemonic(mnemonic: string, mnemonicPath: string = "m/44'/60'/0'/0/0", provider?: providers.Provider) {
    if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null

    if (provider)
        return Wallet.fromMnemonic(mnemonic, mnemonicPath).connect(provider)
    else
        return Wallet.fromMnemonic(mnemonic, mnemonicPath)
}

/**
 * Returns a signer from the web3 current provider (browser only)
 * Returns null if not available
 */
export function signerFromBrowserProvider() {
    if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null
    const provider = new providers.Web3Provider(window["web3"].currentProvider)
    if (!provider.getSigner) return null
    return provider.getSigner()
}
