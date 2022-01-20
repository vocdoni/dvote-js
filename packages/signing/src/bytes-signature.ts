import { Wallet, verifyMessage } from "@ethersproject/wallet"
import { computeAddress } from "@ethersproject/transactions"
import { Signer } from "@ethersproject/abstract-signer"
import { JsonRpcSigner } from "@ethersproject/providers"
import { digestVocdoniSignedPayload } from "./common"
import { ensure0x } from "@vocdoni/common"

export namespace BytesSignature {
    /**
     * Sign a binary payload using the given Ethers wallet or signer.
     * @param request
     * @param walletOrSigner
     */
    export function sign(request: Uint8Array, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")

        if (walletOrSigner instanceof Wallet) {
            return walletOrSigner.signMessage(request)
        }
        else if (walletOrSigner instanceof JsonRpcSigner) {
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
     * Prefix and Sign a binary payload using the given Ethers wallet or signer.
     * @param request
     * @param chainId The ID of the Vocdoni blockchain deployment for which the message is intended to
     * @param walletOrSigner
     */
    export function signVocdoni(request: Uint8Array, chainId: number, walletOrSigner: Wallet | Signer): Promise<string> {
        if (!walletOrSigner) throw new Error("Invalid wallet/signer")
        const digestedRequest = digestVocdoniSignedPayload(request, chainId)

        return sign(digestedRequest, walletOrSigner)
    }

    /**
     * Checks whether the given public key signed the given payload
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param publicKey
     * @param messageBytes Uint8Array of the message
     */
    export function isValid(signature: string, publicKey: string, messageBytes: Uint8Array): boolean {
        if (!publicKey) return true
        else if (!signature) return false

        const actualAddress = verifyMessage(messageBytes, ensure0x(signature))
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
    export function isValidVocdoni(signature: string, publicKey: string, messageBytes: Uint8Array, chainId: number): boolean {
        if (!publicKey) return true
        else if (!signature) return false
        const digestedRequest = digestVocdoniSignedPayload(messageBytes, chainId)

        return isValid(signature, publicKey, digestedRequest)
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
