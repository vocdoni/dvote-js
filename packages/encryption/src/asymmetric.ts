import { Buffer } from "buffer/"
import * as tweetnacl from 'tweetnacl'
import * as sealedbox from 'tweetnacl-sealedbox-js'
import { hexStringToBuffer } from "@vocdoni/common"

(tweetnacl as any).sealedbox = sealedbox

export namespace Asymmetric {
    /**
     * Encrypts the given buffer with NaCl SealedBox using the given hex public key.
     * Returns a buffer with the encrypted payload.
     * @param messageBytes The payload to encrypt
     * @param hexPublicKey 32 byte public key in hex format
     */
    export function encryptRaw(messageBytes: Uint8Array | Buffer, hexPublicKey: string): Buffer {
        if (!(messageBytes instanceof Uint8Array))
            throw new Error("Please, use a Uint8Array or Buffer instance from require('buffer/') to pass the messageBytes")
        else if (typeof hexPublicKey != "string")
            throw new Error("Invalid public key")

        const pubKeyBytes = hexStringToBuffer(hexPublicKey)

        const sealed = sealedbox.seal(messageBytes, pubKeyBytes)
        return Buffer.from(sealed)
    }

    /**
     * Encrypts the given buffer with NaCl SealedBox using the given hex public key.
     * Returns a base64 string with the encrypted payload.
     * @param messageBytes The payload to encrypt
     * @param hexPublicKey 32 byte public key in hex format
     */
    export function encryptBytes(messageBytes: Uint8Array | Buffer, hexPublicKey: string): string {
        if (!(messageBytes instanceof Uint8Array))
            throw new Error("Please, use a Uint8Array or Buffer instance from require('buffer/') to pass the messageBytes")
        else if (typeof hexPublicKey != "string")
            throw new Error("Invalid public key")

        const pubKeyBytes = hexStringToBuffer(hexPublicKey)

        const sealed = sealedbox.seal(messageBytes, pubKeyBytes)
        return Buffer.from(sealed).toString("base64")
    }

    /**
     * Encrypts the given string with NaCl SealedBox using the given hex public key.
     * Returns a base64 string with the encrypted payload.
     * @param message The payload to encrypt
     * @param hexPublicKey 32 byte public key in hex format
     */
    export function encryptString(message: string, hexPublicKey: string): string {
        if (typeof message != "string" || typeof hexPublicKey != "string")
            throw new Error("Invalid parameters")

        const pubKeyBytes = hexStringToBuffer(hexPublicKey)
        const messageBytes = Buffer.from(message)

        const sealed = sealedbox.seal(messageBytes, pubKeyBytes)
        return Buffer.from(sealed).toString("base64")
    }

    /**
     * Decrypts the given buffer with NaCl SealedBox using the given hex private key.
     * Returns the original buffer.
     * @param encryptedBytes The payload to decrypt
     * @param hexPrivateKey 32 byte public key in hex format
     */
    export function decryptRaw(encryptedBytes: Uint8Array | Buffer, hexPrivateKey: string): Buffer {
        if (!(encryptedBytes instanceof Uint8Array))
            throw new Error("Please, use a Uint8Array or Buffer instance from require('buffer/') to pass the encryptedBytes")
        else if (typeof hexPrivateKey != "string")
            throw new Error("Invalid private key")

        const privateKeyBytes = hexStringToBuffer(hexPrivateKey)
        const keyPair = tweetnacl.box.keyPair.fromSecretKey(privateKeyBytes)

        const decryptedBytes = sealedbox.open(encryptedBytes, keyPair.publicKey, keyPair.secretKey)
        if (!decryptedBytes) throw new Error("The message can't be decrypted with the given private key")
        return new Buffer(decryptedBytes)
    }

    /**
     * Decrypts the given base64 string with NaCl SealedBox using the given hex private key.
     * Returns the original buffer.
     * @param encryptedBase64 The payload to decrypt
     * @param hexPrivateKey 32 byte public key in hex format
     */
    export function decryptBytes(encryptedBase64: string, hexPrivateKey: string): Buffer {
        if (typeof encryptedBase64 != "string" || typeof hexPrivateKey != "string")
            throw new Error("Invalid parameters")

        const privateKeyBytes = hexStringToBuffer(hexPrivateKey)
        const keyPair = tweetnacl.box.keyPair.fromSecretKey(privateKeyBytes)

        const encryptedBytes = Buffer.from(encryptedBase64, "base64")

        const decryptedBytes = sealedbox.open(encryptedBytes, keyPair.publicKey, keyPair.secretKey)
        if (!decryptedBytes) throw new Error("The message can't be decrypted with the given private key")
        return new Buffer(decryptedBytes)
    }

    /**
     * Decrypts the given base64 string with NaCl SealedBox using the given hex private key.
     * Returns the original string.
     * @param encryptedBase64 The payload to decrypt
     * @param hexPrivateKey 32 byte public key in hex format
     */
    export function decryptString(encryptedBase64: string, hexPrivateKey: string): string {
        if (typeof encryptedBase64 != "string" || typeof hexPrivateKey != "string")
            throw new Error("Invalid parameters")

        const privateKeyBytes = hexStringToBuffer(hexPrivateKey)
        const keyPair = tweetnacl.box.keyPair.fromSecretKey(privateKeyBytes)

        const encryptedBytes = Buffer.from(encryptedBase64, "base64")

        const decryptedBytes = sealedbox.open(encryptedBytes, keyPair.publicKey, keyPair.secretKey)
        if (!decryptedBytes) throw new Error("The message can't be decrypted with the given private key")
        return new Buffer(decryptedBytes).toString()
    }
}
