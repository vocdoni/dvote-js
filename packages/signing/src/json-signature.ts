import { Wallet, verifyMessage } from "@ethersproject/wallet"
import { computeAddress } from "@ethersproject/transactions"
import { toUtf8Bytes } from "@ethersproject/strings"
import { hashMessage } from "@ethersproject/hash"
import { arrayify } from "@ethersproject/bytes"
import { recoverPublicKey as signingKeyRecoverPublicKey, computePublicKey } from "@ethersproject/signing-key"
import { Signer } from "@ethersproject/abstract-signer"
import { JsonRpcSigner } from "@ethersproject/providers"
import { digestVocdoniSignedPayload, JsonLike, normalizeJsonToString } from "./common"
import { ensure0x } from "@vocdoni/common"
import { BytesSignature } from "./bytes-signature"


export namespace JsonSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer.
     * Ensures that the object keys are alphabetically sorted.
     * @param request
     * @param walletOrSigner
     */
    export function sign(body: JsonLike, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const msg = normalizeJsonToString(body)

        if (walletOrSigner instanceof Wallet) {
            const msgBytes = toUtf8Bytes(msg)
            return walletOrSigner.signMessage(msgBytes)
        }
        else if (walletOrSigner instanceof JsonRpcSigner) {
            // Some providers will use eth_sign without prepending the Ethereum prefix.
            // This will break signatures in some cases (Wallet Connect, Ledger, Trezor, etc).
            // Using personal_sign instead
            return walletOrSigner.getAddress()
                .then(address => (
                    walletOrSigner.provider.send("personal_sign", [
                        msg,
                        address.toLowerCase()
                    ])
                ))
        }

        // Unexpected case, try to sign with eth_sign, even if we would prefer `personal_sign`
        const msgBytes = toUtf8Bytes(msg)
        return walletOrSigner.signMessage(msgBytes)
    }

    /**
     * Checks whether the given public key signed the given JSON with its fields
     * sorted alphabetically
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param responseBody JSON object of the `response` or `error` fields
     */
    export function isValid(signature: string, publicKey: string, responseBody: JsonLike): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const msg = normalizeJsonToString(responseBody)
        const actualAddress = verifyMessage(msg, ensure0x(signature))
        const expectedAddress = computeAddress(ensure0x(publicKey))

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    /**
     * Returns the public key that signed the given JSON data, with its fields sorted alphabetically
     *
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param responseBody JSON object of the `response` or `error` fields
     */
    export function recoverPublicKey(responseBody: JsonLike, signature: string, expanded: boolean = false): string {
        if (!signature) throw new Error("Invalid signature")
        else if (!responseBody) throw new Error("Invalid body")

        const msg = normalizeJsonToString(responseBody)
        // const bodyBytes = toUtf8Bytes(strBody)
        // const msgHash = hashMessage(bodyBytes)
        const msgHash = hashMessage(msg)
        const msgHashBytes = arrayify(msgHash)

        const expandedPubKey = signingKeyRecoverPublicKey(msgHashBytes, signature)

        if (expanded) return expandedPubKey
        return computePublicKey(expandedPubKey, true)
    }
}

export namespace JsonSignatureVocdoni {
    /**
     * Prefix and Sign a JSON payload using the given Ethers wallet or signer.
     * @param request
     * @param chainId The ID of the Vocdoni blockchain deployment for which the message is intended to
     * @param walletOrSigner
     */
    export function sign(body: JsonLike, chainId: string, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const msg = normalizeJsonToString(body)
        const digestedRequest = digestVocdoniSignedPayload(msg, chainId)

        return BytesSignature.sign(digestedRequest, walletOrSigner)
    }

    /**
     * Checks whether the given public key signed the given payload with its fields
     * sorted alphabetically
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param messageBytes Uint8Array of the message
     * @param chainId The ID of the Vocdoni blockchain deployment for which the message is intended to
     */
    export function isValid(signature: string, publicKey: string, responseBody: JsonLike, chainId: string): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const msg = normalizeJsonToString(responseBody)
        const digestedMsg = digestVocdoniSignedPayload(msg, chainId)

        const actualAddress = verifyMessage(digestedMsg, ensure0x(signature))
        const expectedAddress = computeAddress(ensure0x(publicKey))

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    /**
     * Returns the public key that signed the given JSON data, with its fields sorted alphabetically
     *
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param responseBody JSON object of the `response` or `error` fields
     */
    export function recoverPublicKey(responseBody: JsonLike, signature: string, chainId: string, expanded: boolean = false): string {
        if (!signature) throw new Error("Invalid signature")
        else if (!responseBody) throw new Error("Invalid body")

        const msg = normalizeJsonToString(responseBody)
        const digestedMsg = digestVocdoniSignedPayload(msg, chainId)

        const msgHash = hashMessage(digestedMsg)
        const msgHashBytes = arrayify(msgHash)

        const expandedPubKey = signingKeyRecoverPublicKey(msgHashBytes, signature)

        if (expanded) return expandedPubKey
        return computePublicKey(expandedPubKey, true)
    }
}
