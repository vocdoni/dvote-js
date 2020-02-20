import { Wallet, Signer, utils } from "ethers"

/**
 * Sign a JSON payload using the given Ethers wallet or signer. 
 * Ensures that the object keys are alphabetically sorted.
 * @param request 
 * @param walletOrSigner 
 */
export function signJsonBody(request: any, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!walletOrSigner) throw new Error("Invalid wallet/signer")

    request = sortObjectFields(request)
    const msg = JSON.stringify(request)
    return walletOrSigner.signMessage(msg)
}

/**
 * Checks whether the given public key signed the given JSON with its fields
 * sorted alphabetically
 * @param signature Hex encoded signature (created with the Ethereum prefix)
 * @param publicKey
 * @param responseBody JSON object of the `response` or `error` fields
 */
export function isSignatureValid(signature: string, publicKey: string, responseBody: any): boolean {
    if (!publicKey) return true
    else if (!signature) return false

    const gwPublicKey = publicKey.startsWith("0x") ? publicKey : "0x" + publicKey
    const expectedAddress = utils.computeAddress(gwPublicKey)

    responseBody = sortObjectFields(responseBody)
    let strBody: string
    if (typeof responseBody != "string") strBody = JSON.stringify(responseBody)
    else strBody = responseBody

    if (!signature.startsWith("0x")) signature = "0x" + signature
    const actualAddress = utils.verifyMessage(strBody, signature)

    return actualAddress && expectedAddress && (actualAddress == expectedAddress)
}

/**
 * Returns the public key that signed the given JSON data, with its fields sorted alphabetically
 * 
 * @param signature Hex encoded signature (created with the Ethereum prefix)
 * @param responseBody JSON object of the `response` or `error` fields
 */
export function recoverSignerPublicKey(responseBody: any, signature: string): string {
    if (!signature) throw new Error("Invalid signature")
    else if (!responseBody) throw new Error("Invalid body")

    responseBody = sortObjectFields(responseBody)
    const message = JSON.stringify(responseBody)
    const msgHash = utils.hashMessage(message)
    const msgHashBytes = utils.arrayify(msgHash)
    return utils.recoverPublicKey(msgHashBytes, signature)
}

/**
 * Sort JSON data so that signatures are 100% reproduceable
 * @param data
 */
export function sortObjectFields(data: any) {
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

    if (Array.isArray(data)) return data

    // Ensure ordered key names
    return Object.keys(data).sort().reduce((prev, cur) => {
        prev[cur] = sortObjectFields(data[cur])
        return prev
    }, {})
}
