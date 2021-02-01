import { Wallet, Signer, utils } from "ethers"
import { compressPublicKey } from "./elliptic"

export class JsonSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer.
     * Ensures that the object keys are alphabetically sorted.
     * @param request
     * @param walletOrSigner
     */
    static sign(request: any, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        const sortedRequest = JsonSignature.sort(request)
        const msg = JSON.stringify(sortedRequest)
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
    static isValid(signature: string, publicKey: string, responseBody: any): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const gwPublicKey = publicKey.startsWith("0x") ? publicKey : "0x" + publicKey
        const expectedAddress = utils.computeAddress(gwPublicKey)

        const sortedResponseBody = JsonSignature.sort(responseBody)
        const bodyBytes = utils.toUtf8Bytes(JSON.stringify(sortedResponseBody))

        if (!signature.startsWith("0x")) signature = "0x" + signature
        const actualAddress = utils.verifyMessage(bodyBytes, signature)

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }

    /**
     * Returns the public key that signed the given JSON data, with its fields sorted alphabetically
     *
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param responseBody JSON object of the `response` or `error` fields
     */
    static recoverPublicKey(responseBody: any, signature: string, expanded: boolean = false): string {
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
    static sort(data: any) {
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


export class BytesSignature {
    /**
     * Sign a JSON payload using the given Ethers wallet or signer. 
     * Ensures that the object keys are alphabetically sorted.
     * @param request 
     * @param walletOrSigner 
     */
    static sign(request: Uint8Array, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        return walletOrSigner.signMessage(request)
    }

    /**
     * Checks whether the given public key signed the given JSON with its fields
     * sorted alphabetically
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param responseBody Uint8Array of the inner response JSON object
     */
    static isValid(signature: string, publicKey: string, responseBody: Uint8Array): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const gwPublicKey = publicKey.startsWith("0x") ? publicKey : "0x" + publicKey
        const expectedAddress = utils.computeAddress(gwPublicKey)

        if (!signature.startsWith("0x")) signature = "0x" + signature
        const actualAddress = utils.verifyMessage(responseBody, signature)

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }
}
