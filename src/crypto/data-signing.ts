import { Wallet, Signer, utils, providers } from "ethers"
import { ensure0x } from "../util/hex"
import { compressPublicKey } from "./elliptic"

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
            const msgBytes = utils.toUtf8Bytes(msg)
            return walletOrSigner.signMessage(msgBytes)
        }
        else if (walletOrSigner instanceof providers.JsonRpcSigner) {
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
        const msgBytes = utils.toUtf8Bytes(msg)
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

        const gwPublicKey = ensure0x(publicKey)
        const expectedAddress = utils.computeAddress(gwPublicKey)

        const sortedResponseBody = JsonSignature.sort(responseBody)
        const bodyBytes = utils.toUtf8Bytes(JSON.stringify(sortedResponseBody))

        signature = ensure0x(signature)
        const actualAddress = utils.verifyMessage(bodyBytes, signature)

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
        const bodyBytes = utils.toUtf8Bytes(strBody)
        const msgHash = utils.hashMessage(bodyBytes)
        const msgHashBytes = utils.arrayify(msgHash)

        const expandedPubKey = utils.recoverPublicKey(msgHashBytes, signature)
        if (expanded) return expandedPubKey
        return compressPublicKey(expandedPubKey)
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


export namespace BytesSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer. 
     * Ensures that the object keys are alphabetically sorted.
     * @param request 
     * @param walletOrSigner 
     */
    export function sign(request: Uint8Array, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        if (walletOrSigner instanceof Wallet) {
            return walletOrSigner.signMessage(request)
        }
        else if (walletOrSigner instanceof providers.JsonRpcSigner) {
            // Some providers will use eth_sign without prepending the Ethereum prefix.
            // This will break signatures in some cases (Wallet Connect, Ledger, Trezor, etc).
            // Using personal_sign instead
            return walletOrSigner.getAddress()
                .then(address => (
                    walletOrSigner.provider.send("personal_sign", [
                        uint8ArrayToArray(request),
                        address.toLowerCase()
                    ])
                ))
        }

        // Unexpected case, try to sign with eth_sign, even if we would prefer `personal_sign`
        return walletOrSigner.signMessage(request)
    }

    /**
     * Checks whether the given public key signed the given JSON with its fields
     * sorted alphabetically
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param messageBytes Uint8Array of the inner response JSON object
     */
    export function isValid(signature: string, publicKey: string, messageBytes: Uint8Array): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const gwPublicKey = ensure0x(publicKey)
        const expectedAddress = utils.computeAddress(gwPublicKey)

        signature = ensure0x(signature)
        const actualAddress = utils.verifyMessage(messageBytes, signature)

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    // Helpers

    function uint8ArrayToArray(buff: Uint8Array): number[] {
        const result = []
        for (let i = 0; i < buff.length; ++i) {
            result.push(buff[i])
        }
        return result
    }
}
