import { utils } from "ethers"
import { Keccak256, Poseidon } from "@vocdoni/hashing"
import { hexStringToBuffer } from "@vocdoni/common"

export namespace CensusOffChain {
    /**
     * A census ID consists of the Entity Address and the hash of the name.
     * This function returns the full Census ID
     */
    export function generateCensusId(censusName: string, entityAddress: string) {
        const prefix = "0x" + entityAddress.toLowerCase().substr(2)
        const suffix = generateCensusIdSuffix(censusName)
        return prefix + "/" + suffix
    }

    /**
     * A census ID consists of the Entity Address and the hash of the name.
     * This function computes the second term
     */
    export function generateCensusIdSuffix(censusName: string) {
        // A census ID consists of the Entity Address and the hash of the name
        // Now computing the second term
        return Keccak256.hashText(censusName.toLowerCase().trim())
    }

    export namespace Public {
        /**
         * Returns a base64 representation of the given ECDSA public key
         */
        export function encodePublicKey(publicKey: string | Uint8Array | Buffer | number[]): string {
            const compPubKey = utils.computePublicKey(publicKey, true)
            const pubKeyBytes = hexStringToBuffer(compPubKey)

            return pubKeyBytes.toString("base64")
        }
    }

    export namespace Anonymous {
        /**
         * Returns a base64 representation of the Poseidon hash of the given public key,
         * left padded to 32 bytes
         */
        export function digestPublicKey(x: bigint, y: bigint): string {
            const hashedPubKey = Poseidon.hashBabyJubJubPublicKey(x, y)

            let hexHashedPubKey = hashedPubKey.toString(16)

            // Using big-endian, pad any missing bytes until we get 32 bytes
            while (hexHashedPubKey.length < 64) {
                hexHashedPubKey = "0" + hexHashedPubKey
            }

            return Buffer.from(hexHashedPubKey, "hex").toString("base64")
        }
    }
}
