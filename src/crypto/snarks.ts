import * as createBlakeHash from "blake-hash"
import { eddsa, babyJub } from "circomlib"
import { groth16 } from "snarkjs"
import { Scalar, utils as ffutils } from "ffjavascript"
import { bufferToBigInt } from "../util/encoding"
import { WalletBabyJub } from "./wallets"

export type ZkInputs = {
  processId: string
  /** hex string */
  censusRoot: string
  /** hex strings */
  censusSiblings: string[]
  privateKey: BigInt
  votes: number[]
  /** hex string */
  nullifier: string
}

export function getZkProof(inputs: ZkInputs, circuitWasm: Uint8Array, circuitKey: Uint8Array): { proof, publicSignals } {
  // TODO: WIP

  const zkInputs = {
    censusRoot: 10218369977673547523728355147149957098711008851521388639921026317490981642638n,
    censusSiblings: [0n, 0n, 0n, 0n],
    privateKey: 3876493977147089964395646989418653640709890493868463039177063670701706079087n,
    voteValue: 2n,
    electionId: 1n,
    nullifier: 3186036676392928174548062723257977428484950876976874299082067205621815010072n
  };

  return groth16.fullProve(inputs, "circuit.wasm", "circuit_final.zkey");
}

export function verifyZkProof(verificationKey, publicSignals, proof) {
  return Promise.resolve(false)
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////
