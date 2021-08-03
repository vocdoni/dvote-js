import * as createBlakeHash from "blake-hash"
import { eddsa, babyJub } from "circomlib"
import { groth16 } from "snarkjs"
import { Scalar, utils as ffutils } from "ffjavascript"
import { bufferToBigInt } from "../util/encoding"
import { WalletBabyJub } from "./wallets"
import { ensure0x } from "../util/hex"

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

export function getZkProof(input: ZkInputs, circuitWasm: Uint8Array, circuitKey: Uint8Array): { proof, publicSignals } {
  const voteValue = encodeVotes(input.votes)

  const proverInputs = {
    censusRoot: BigInt(ensure0x(input.censusRoot)),
    censusSiblings: input.censusSiblings.map(item => BigInt(ensure0x(item))),
    privateKey: input.privateKey,
    voteValue: BigInt(voteValue),
    electionId: BigInt(ensure0x(input.processId)),
    nullifier: BigInt(ensure0x(input.nullifier))
  }

  return groth16.fullProve(proverInputs, circuitWasm, circuitKey);
}

export function verifyZkProof(verificationKey, publicSignals, proof) {
  return Promise.resolve(false)
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

/** Encodes the following votes into a 2-byte item hex string */
function encodeVotes(votes: number[]): string {
  let result = "0x"
  for (let vote of votes) {
    if (vote < 0 || vote >= 65536) throw new Error("Vote value out of bounds")

    const hexStr = "000" + vote.toString()
    result += hexStr.substr(-4)  // the last 2 bytes
  }
  return result
}
