import { providers, Wallet, utils } from "ethers"
import * as createBlakeHash from "blake-hash"
import { eddsa, babyJub } from "circomlib"
// Note: Importing ffjavascript as an ES module will not work
// import { Scalar, utils as ffutils } from "ffjavascript"
// const { Scalar, utils: ffutils } = require("../../node_modules/ffjavascript/build/main.cjs")
const { Scalar, utils: ffutils } = require("ffjavascript")
import { bufferToBigInt } from "../util/encoding"
import { ensure0x, strip0x } from "../util/hex"

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

export type PublicKeyBabyJub = { x: bigint, y: bigint }

export class WalletBabyJub {
    private _rawPrivKey: Buffer

    constructor(rawPrivateKey: Buffer) {
        if (!(rawPrivateKey instanceof Uint8Array)) throw new Error("Invalid private key (buffer)")
        else if (rawPrivateKey.length != 32) throw new Error("The raw private key buffer has to be 32 bytes long. Use fromHexSeed instead.")

        this._rawPrivKey = rawPrivateKey
    }

    /** Creates a given wallet by hashing the given hex seed into a 32 byte buffer
     * and using it as a raw private key
     */
    static fromHexSeed(hexSeed: string) {
        const seedBytes = Buffer.from(hexSeed.replace("0x", ""), "hex")
        const hashedBytes = utils.keccak256(seedBytes).slice(2)

        return new WalletBabyJub(Buffer.from(hashedBytes, "hex"))
    }

    /** Concatenates the given login key and process ID with the UTF8 hex representation of the
     * given secret string and returns a  Baby Jub wallet using that as the private key
     */
    static fromProcessCredentials(hexLoginKey: string, hexProcessId: string, userSecret: string) {
        const hexSeed = hexLoginKey.replace(/^0x/, "") +
            hexProcessId.replace(/^0x/, "") +
            Buffer.from(userSecret, "utf8").toString("hex")

        return WalletBabyJub.fromHexSeed(hexSeed)
    }

    /** Returns the private key originally provided */
    public get rawPrivateKey(): Buffer {
        return this._rawPrivKey
    }

    private get hashedRawPrivateKey(): Buffer {
        return createBlakeHash("blake512").update(this._rawPrivKey).digest()
    }

    /** Returns the blake hash of the original private key, as a bigint.
     * Use this value to feed to the snarks circuit.
     */
    public get privateKey(): bigint {
        const h1 = this.hashedRawPrivateKey
        const sBuff: Buffer = eddsa.pruneBuffer(h1.slice(0, 32))
        const s: bigint = ffutils.leBuff2int(sBuff)
        return Scalar.shr(s, 3) as bigint
    }

    /** Returns the two points of the public key coordinate as big integers */
    public get publicKey(): PublicKeyBabyJub {
        const [pubKeyX, pubKeyY] = babyJub.mulPointEscalar(babyJub.Base8, this.privateKey) as [bigint, bigint]

        return { x: pubKeyX, y: pubKeyY }
    }

    /** Returns the signature of the given message using the wallet's private key */
    public sign(msg: Buffer): { R8: [bigint, bigint], S: bigint } {
        if (!msg) throw new Error("Invalid message")

        const biMsg = bufferToBigInt(msg)
        return eddsa.signPoseidon(this._rawPrivKey, biMsg)
    }

    static verify(msg: Buffer, sig: ReturnType<typeof WalletBabyJub.prototype.sign>, pubKey: PublicKeyBabyJub) {
        const biMsg = bufferToBigInt(msg)
        return eddsa.verifyPoseidon(biMsg, sig, [pubKey.x, pubKey.y])
    }
}

export namespace SignerUtil {
    /**
     * Returns a Web3 signer if the browser supports it or if Metamask is available
     * Returns null otherwise
     */
    export function fromInjectedWeb3() {
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

    hexSeed = strip0x(hexSeed)
    if (hexSeed.length != 64) throw new Error("The hashed passphrase should be 64 characters long instead of " + hexSeed.length)

    // Conver the passphrase into UTF8 bytes and hash them
    const passphraseBytes = utils.toUtf8Bytes(passphrase)
    const passphraseBytesHashed = utils.keccak256(passphraseBytes).substr(2) // skip 0x

    if (passphraseBytesHashed.length != 64)
        throw new Error("Internal error: The hashed passphrase should be 64 characters long instead of " + passphraseBytesHashed.length)

    // Concatenating the bytes of the hashed passphrase + the seed's
    const sourceBytes = utils.arrayify(ensure0x(passphraseBytesHashed + hexSeed))
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
