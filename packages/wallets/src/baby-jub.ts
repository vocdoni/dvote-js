import { utils } from "ethers"
import * as createBlakeHash from "blake-hash"
import { eddsa, babyJub } from "circomlib"
// Note: Importing ffjavascript as an ES module will not work
// import { Scalar, utils as ffutils } from "ffjavascript"
// const { Scalar, utils: ffutils } = require("../../node_modules/ffjavascript/build/main.cjs")
const { Scalar, utils: ffutils } = require("ffjavascript")
import { bufferToBigInt } from "vocdoni-common" // TODO: Import from the new NPM package

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
