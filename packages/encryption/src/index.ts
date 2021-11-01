import { Buffer } from "buffer/"
import * as tweetnacl from 'tweetnacl'
import * as sealedbox from 'tweetnacl-sealedbox-js'
import { hexStringToBuffer } from "vocdoni-common"
import { sha256 } from "@ethersproject/sha2"

(tweetnacl as any).sealedbox = sealedbox

const newNonce = () => tweetnacl.randomBytes(tweetnacl.secretbox.nonceLength)

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

export namespace Symmetric {
    /**
     * Encrypts the given buffer with NaCl SecretBox using the given passpahrase and a random nonce.
     * Returns a Buffer containing `nonce[24] + cipherText[]`.
     * @param messageBytes The payload to encrypt
     * @param passphrase The secret key in string format
     */
    export function encryptRaw(messageBytes: Uint8Array | Buffer, passphrase: string): Buffer {
        if (!(messageBytes instanceof Uint8Array))
            throw new Error("Please, provide a Uint8Array or a Buffer instance from require('buffer/') to pass the messageBytes")
        else if (typeof passphrase != "string")
            throw new Error("Invalid passphrase")

        const key = Buffer.from(passphrase, "utf-8")
        const keyDigest = sha256(key)
        const nonce = newNonce()

        const box = tweetnacl.secretbox(messageBytes, nonce, hexStringToBuffer(keyDigest))

        const fullMessage = new Uint8Array(nonce.length + box.length);
        fullMessage.set(nonce);
        fullMessage.set(box, nonce.length);

        return Buffer.from(fullMessage)
    }

    /**
     * Encrypts the given buffer with NaCl SecretBox using the given passpahrase and a random nonce.
     * Returns a base64 string with the encrypted payload.
     * @param messageBytes The payload to encrypt
     * @param passphrase The secret key in string format
     */
    export function encryptBytes(messageBytes: Uint8Array | Buffer, passphrase: string): string {
        if (!(messageBytes instanceof Uint8Array))
            throw new Error("Please, use a Uint8Array or Buffer instance from require('buffer/') to pass the messageBytes")
        else if (typeof passphrase != "string")
            throw new Error("Invalid passphrase")

        const encryptedMessage = this.encryptRaw(messageBytes, passphrase)

        return Buffer.from(encryptedMessage).toString("base64")
    }

    /**
     * Encrypts the given string with NaCl SecretBox using the given passpahrase and a random nonce.
     * Returns a base64 string with the encrypted payload.
     * @param message The payload to encrypt
     * @param passphrase The secret key in string format
     */
    export function encryptString(message: string, passphrase: string): string {
        if (typeof message != "string" || typeof passphrase != "string")
            throw new Error("Invalid parameters")

        const messageBytes = Buffer.from(message, "utf-8")
        const encryptedMessageBytes = this.encryptRaw(messageBytes, passphrase)

        return Buffer.from(encryptedMessageBytes).toString("base64")
    }

    /**
     * Decrypts the given buffer with NaCl SecretBox using the given passpahrase.
     * Returns the original buffer.
     * @param encryptedBytes The payload to decrypt
     * @param passphrase The secret key in string format
     */
    export function decryptRaw(encryptedBytes: Uint8Array | Buffer, passphrase: string): Buffer {
        if (!(encryptedBytes instanceof Uint8Array))
            throw new Error("Please, use a Uint8Array or Buffer instance from require('buffer/') to pass the encryptedBytes")
        else if (typeof passphrase != "string")
            throw new Error("Invalid passaphrase")

        const key = Buffer.from(passphrase, "utf-8")
        const keyDigest = sha256(key)
        const keyDigestBytes = hexStringToBuffer(keyDigest)

        const nonce = encryptedBytes.slice(0, tweetnacl.secretbox.nonceLength);
        const message = encryptedBytes.slice(
            tweetnacl.secretbox.nonceLength,
            encryptedBytes.length
        )

        const decrypted = tweetnacl.secretbox.open(message, nonce, keyDigestBytes);

        if (!decrypted) {
            throw new Error("Could not decrypt message");
        }

        return new Buffer(decrypted)
    }

    /**
     * Decrypts the given base64 string with NaCl SecretBox using the given passpahrase and a random nonce.
     * Returns the original buffer.
     * @param encryptedBase64 The payload to decrypt
     * @param passphrase The secret key in string format
     */
    export function decryptBytes(encryptedBase64: string, passphrase: string): Buffer {
        if (typeof encryptedBase64 != "string" || typeof passphrase != "string")
            throw new Error("Invalid parameters")

        const encryptedBytes = Buffer.from(encryptedBase64, "base64")

        return this.decryptRaw(encryptedBytes, passphrase)
    }

    /**
     * Decrypts the given base64 string with NaCl SecretBox using the given passpahrase and a random nonce.
     * Returns the original string.
     * @param encryptedBase64 The payload to decrypt
     * @param passphrase The secret key in string format
     */
    export function decryptString(encryptedBase64: string, passphrase: string): string {
        if (typeof encryptedBase64 != "string" || typeof passphrase != "string")
            throw new Error("Invalid parameters")


        const encryptedBytes = Buffer.from(encryptedBase64, "base64")
        const decryptedBytes = this.decryptRaw(encryptedBytes, passphrase)

        if (!decryptedBytes) throw new Error("The message can't be decrypted with the given passphrase")
        return new Buffer(decryptedBytes).toString()
    }
}
