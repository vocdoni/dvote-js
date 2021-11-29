import { poseidon } from "circomlib"

export namespace Poseidon {
    export const Q = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")

    /** Computes the raw poseidon hash of an array of big integers */
    export function hash(inputs: bigint[]): bigint {
        if (inputs.some(value => value >= Q || value < BigInt("0"))) {
            throw new Error("One or more inputs are out of the Poseidon field")
        }
        return poseidon(inputs)
    }

    /** Computes the poseidon hash of the uncompressed coordinates of a
     * Baby JubJub public key
     */
    export function hashBabyJubJubPublicKey(x: bigint, y: bigint) {
        return Poseidon.hash([x, y])
    }
}
