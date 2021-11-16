import { Wallet, verifyMessage } from "@ethersproject/wallet"
import { computeAddress } from "@ethersproject/transactions"
import { toUtf8Bytes } from "@ethersproject/strings"
import { hashMessage } from "@ethersproject/hash"
import { arrayify } from "@ethersproject/bytes"
import { recoverPublicKey as signingKeyRecoverPublicKey, computePublicKey } from "@ethersproject/signing-key"
import { Signer } from "@ethersproject/abstract-signer"
import { JsonRpcSigner } from "@ethersproject/providers"

export namespace JsonSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer.
     * Ensures that the object keys are alphabetically sorted.
     * @param request
     * @param walletOrSigner
     */
    export function sign(request: any, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const sortedRequest = JsonSignature.sort(request)
        const msg = JSON.stringify(sortedRequest)

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
    export function isValid(signature: string, publicKey: string, responseBody: any): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const gwPublicKey = publicKey.startsWith("0x") ? publicKey : "0x" + publicKey
        const expectedAddress = computeAddress(gwPublicKey)

        const sortedResponseBody = JsonSignature.sort(responseBody)
        const bodyBytes = toUtf8Bytes(JSON.stringify(sortedResponseBody))

        if (!signature.startsWith("0x")) signature = "0x" + signature
        const actualAddress = verifyMessage(bodyBytes, signature)

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    /**
     * Returns the public key that signed the given JSON data, with its fields sorted alphabetically
     *
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param responseBody JSON object of the `response` or `error` fields
     */
    export function recoverPublicKey(responseBody: any, signature: string, expanded: boolean = false): string {
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
            case "boolean":
            case "function":
            case "number":
            case "string":
            case "symbol":
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
