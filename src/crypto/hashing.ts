import { utils } from "ethers"
import { poseidon } from "circomlib"
import { Buffer } from "buffer/"

export namespace Keccak256 {
    export function hashText(value: string): string {
        return utils.keccak256(Buffer.from(value, "utf8"))
    }
    export function hashHexString(value: string): string {
        return utils.keccak256(Buffer.from(value, "hex"))
    }
    export function hashBytes(value: Uint8Array): string {
        return utils.keccak256(value)
    }
}

export namespace Poseidon {
    export const Q = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")

    /** Computes the raw poseidon hash of an array of big integers */
    export function hash(inputs: bigint[]): bigint {
        const modInputs = inputs.map(value => value % Q)
        return poseidon(modInputs)
    }

    /** Computes the poseidon hash of the uncompressed coordinates of a
     * Baby JubJub public key
     */
    export function hashBabyJubJubPublicKey(x: bigint, y: bigint) {
        return Poseidon.hash([x, y])
    }

    /** Computes the nullifier of a voter for a given process ID.
     * The private key should be a decimal string containing a big number. */
    export function getNullifier(privateKey: string, processId: bigint) {
        const sKey = BigInt(privateKey)
        return Poseidon.hash([sKey, processId])
    }
}

