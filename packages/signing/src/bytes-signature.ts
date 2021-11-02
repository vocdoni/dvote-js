import { Wallet, Signer, utils, providers } from "ethers"

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

        const gwPublicKey = publicKey.startsWith("0x") ? publicKey : "0x" + publicKey
        const expectedAddress = utils.computeAddress(gwPublicKey)

        if (!signature.startsWith("0x")) signature = "0x" + signature
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
