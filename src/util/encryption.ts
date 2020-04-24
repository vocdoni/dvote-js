import { Buffer } from "buffer/"
import * as tweetnacl from 'tweetnacl'
import * as sealedbox from 'tweetnacl-sealedbox-js'
import { hexStringToBuffer } from "./encoding"

(tweetnacl as any).sealedbox = sealedbox

export class Asymmetric {
    static encryptString(message: string, publicKey: string): string {
        if (typeof message != "string" || typeof publicKey != "string")
            throw new Error("Invalid parameters")

        const pubKeyBytes = hexStringToBuffer(publicKey)
        const messageBytes = Buffer.from(message)

        const sealed = sealedbox.seal(messageBytes, pubKeyBytes)
        return Buffer.from(sealed).toString("base64")
    }

    static decryptString(encryptedBase64: string, privateKey: string): string {
        if (typeof encryptedBase64 != "string" || typeof privateKey != "string")
            throw new Error("Invalid parameters")

        const privateKeyBytes = hexStringToBuffer(privateKey)
        const keyPair = tweetnacl.box.keyPair.fromSecretKey(privateKeyBytes)

        const encryptedBytes = Buffer.from(encryptedBase64, "base64")

        const decryptedBytes = sealedbox.open(encryptedBytes, keyPair.publicKey, keyPair.secretKey)
        if (!decryptedBytes) throw new Error("The message can't be decrypted with the given private key")
        return new Buffer(decryptedBytes).toString()
    }
}
