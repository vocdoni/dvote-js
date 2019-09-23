import { Wallet, Signer, utils } from "ethers"

/**
 * Sign a JSON payload using the given Ethers wallet or signer
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
 * 
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
