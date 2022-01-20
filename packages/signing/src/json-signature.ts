import { Wallet, verifyMessage } from "@ethersproject/wallet"
import { computeAddress } from "@ethersproject/transactions"
import { toUtf8Bytes } from "@ethersproject/strings"
import { hashMessage } from "@ethersproject/hash"
import { arrayify } from "@ethersproject/bytes"
import { recoverPublicKey as signingKeyRecoverPublicKey, computePublicKey } from "@ethersproject/signing-key"
import { Signer } from "@ethersproject/abstract-signer"
import { JsonRpcSigner } from "@ethersproject/providers"
import { digestVocdoniSignedPayload } from "./common"
import { ensure0x } from "@vocdoni/common"

type JsonLike = boolean | number | string | JsonLike[] | { [k: string]: JsonLike } | null

export namespace JsonSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer.
     * Ensures that the object keys are alphabetically sorted.
     * @param request
     * @param walletOrSigner
     */
    export function sign(request: JsonLike, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const sortedRequest = JsonSignature.sort(request)
        const msg = JSON.stringify(sortedRequest)

        return _sign(msg, walletOrSigner)
    }

    /**
     * Prefix and Sign a JSON payload using the given Ethers wallet or signer.
     * @param request
     * @param chainId The ID of the Vocdoni blockchain deployment for which the message is intended to
     * @param walletOrSigner
     */
    export function signVocdoni(request: JsonLike, chainId: number, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const sortedRequest = JsonSignature.sort(request)
        const msg = JSON.stringify(sortedRequest)

        const digestedRequest = digestVocdoniSignedPayload(msg, chainId)

        return sign(digestedRequest, walletOrSigner)
    }


    function _sign(msg: string, walletOrSigner: Wallet | Signer): Promise<string> {
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

        const sortedResponseBody = JsonSignature.sort(responseBody)
        const bodyBytes = toUtf8Bytes(JSON.stringify(sortedResponseBody))

        const actualAddress = verifyMessage(bodyBytes, ensure0x(signature))
        const expectedAddress = computeAddress(ensure0x(publicKey))

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    /**
     * Checks whether the given public key signed the given payload with its fields
     * sorted alphabetically
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param messageBytes Uint8Array of the message
     * @param chainId The ID of the Vocdoni blockchain deployment for which the message is intended to
     */
    export function isValidVocdoni(signature: string, publicKey: string, responseBody: JsonLike, chainId: number): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const sortedResponseBody = JsonSignature.sort(responseBody)
        const bodyBytes = toUtf8Bytes(JSON.stringify(sortedResponseBody))
        const digestedRequest = digestVocdoniSignedPayload(bodyBytes, chainId)

        const actualAddress = verifyMessage(digestedRequest, ensure0x(signature))
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

        responseBody = JsonSignature.sort(responseBody)
        const strBody = JSON.stringify(responseBody)
        const bodyBytes = toUtf8Bytes(strBody)
        const msgHash = hashMessage(bodyBytes)
        const msgHashBytes = arrayify(msgHash)

        const expandedPubKey = signingKeyRecoverPublicKey(msgHashBytes, signature)
        if (expanded) return expandedPubKey
        return computePublicKey(expandedPubKey, true)
    }

    /**
     * Returns a copy of the JSON data so that fields are ordered alphabetically and signatures are 100% reproduceable
     * @param data Any valid JSON payload
     */
    export function sort(data: any) {
        switch (typeof data) {
            case "bigint":
            case "function":
            case "symbol":
                throw new Error("JSON objects with " + typeof data + " values are not supported")
            case "boolean":
            case "number":
            case "string":
            case "undefined":
                return data
        }

        if (Array.isArray(data)) return data.map(item => JsonSignature.sort(item))

        // Ensure ordered key names
        return Object.keys(data).sort().reduce((prev, cur) => {
            prev[cur] = JsonSignature.sort(data[cur])
            return prev
        }, {})
    }
}
