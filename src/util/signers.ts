import { providers, Wallet, utils } from "ethers"

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

export class SignerUtil {
    /**
     * Returns a Web3 signer if the browser supports it or if Metamask is available
     * Returns null otherwise
     */
    static fromInjectedWeb3() {
        if (typeof window == "undefined" || typeof window["web3"] == "undefined") return null

        const provider = new providers.Web3Provider(window["web3"].currentProvider)
        if (!provider.getSigner) return null
        return provider.getSigner()
    }
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Returns `false` if the passphrase is shorter than 8 characters, or it doesn't contain
 * at least one digit, one lowercase character and an uppercase one
 * @param passphrase 
 */
function isStrongPassphrase(passphrase: string): boolean {
    if (passphrase.length < 8) return false
    else if (!passphrase.match(/[a-z]+/)) return false
    else if (!passphrase.match(/[A-Z]+/)) return false
    else if (!passphrase.match(/[0-9]+/)) return false
    return true
}

/**
 * Generates a deterministic 32 byte payload from the given UTF8 passphrase and the given hexadecimal seed.
 * @param passphrase A UTF8 string
 * @param hexSeed A 32 byte hex string with the leading '0x'
 * @param rounds Number of hashing rounds to apply to the resulting payload (default: 10)
 */
function digestSeededPassphrase(passphrase: string, hexSeed: string, rounds: number = 10): string {
    if (typeof passphrase != "string" || typeof hexSeed != "string") throw new Error("Invalid parameters")

    if (hexSeed.startsWith("0x")) hexSeed = hexSeed.substr(2)
    if (hexSeed.length != 64) throw new Error("The hashed passphrase should be 64 characters long instead of " + hexSeed.length)

    // Conver the passphrase into UTF8 bytes and hash them
    const passphraseBytes = utils.toUtf8Bytes(passphrase)
    const passphraseBytesHashed = utils.keccak256(passphraseBytes).substr(2) // skip 0x

    if (passphraseBytesHashed.length != 64)
        throw new Error("Internal error: The hashed passphrase should be 64 characters long instead of " + passphraseBytesHashed.length)

    // Concatenating the bytes of the hashed passphrase + the seed's
    const sourceBytes = utils.arrayify("0x" + passphraseBytesHashed + hexSeed)
    if (sourceBytes.length != 64)
        throw new Error("Internal error: The sourceBytes array should be 64 bytes long instead of " + sourceBytes.length)

    let result: string

    // Perform N rounds of keccak256
    for (let i = 0; i < rounds; i++) {
        if (typeof result == "undefined") result = utils.keccak256(sourceBytes)
        else result = utils.keccak256(result)
    }

    return result
}
