import { providers, Wallet } from "ethers"
import { isStrongPassphrase, digestSeededPassphrase } from "./util/helpers"

export class WalletUtil {
    /**
     * Returns a standalone Ethers.js wallet and connects it to the given provider if one is set. It uses the given passphrase and
     * hexSeed to compute a deterministic private key along with some seed to salt the passphrase. Use `Random.getHex`
     * to generate a secure random seed.
     * @param passphrase
     * @param hexSeed
     * @param provider (optional)
     */
    static fromSeededPassphrase(passphrase: string, hexSeed: string, provider?: providers.Provider): Wallet {
        if (typeof passphrase != "string") throw new Error("The passphrase must be a string")
        else if (!isStrongPassphrase(passphrase)) throw new Error("The passphrase is not strong enough")
        else if (typeof hexSeed != "string") throw new Error("The hexSeed must be a hex string: use Random.getHex() to create a new one")

        const privateKey = digestSeededPassphrase(passphrase, hexSeed)

        return provider ?
            new Wallet(privateKey).connect(provider) :
            new Wallet(privateKey)
    }

    /**
     * Returns a standalone Ethers.js wallet and connects it to the given provider if one is set
     * @param mnemonic
     * @param mnemonicPath (optional)
     * @param provider (optional)
     */
    static fromMnemonic(mnemonic: string, mnemonicPath: string = "m/44'/60'/0'/0/0", provider?: providers.Provider) {
        return provider ?
            Wallet.fromMnemonic(mnemonic, mnemonicPath).connect(provider) :
            Wallet.fromMnemonic(mnemonic, mnemonicPath)
    }
}
