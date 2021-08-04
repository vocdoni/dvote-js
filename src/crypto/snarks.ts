import { groth16 } from "snarkjs"
import { utils } from "ethers"
import { Poseidon } from "./hashing"
import { ensure0x } from "../util/hex"
import { VoteValues } from "../common"

export type ZkInputs = {
  processId: string
  /** hex string */
  censusRoot: string
  /** hex strings */
  censusSiblings: string[]
  secretKey: BigInt
  votes: VoteValues
  /** hex string */
  nullifier: string
}

export function getZkProof(input: ZkInputs, circuitWasm: Uint8Array, circuitKey: Uint8Array) {
  const voteValue = digestVotevalue(input.votes)

  const proverInputs = {
    censusRoot: BigInt(ensure0x(input.censusRoot)),
    censusSiblings: input.censusSiblings.map(item => BigInt(ensure0x(item))),
    secretKey: input.secretKey,
    voteValue: BigInt(voteValue),
    electionId: BigInt(ensure0x(input.processId)),
    nullifier: BigInt(ensure0x(input.nullifier))
  }

  const { proof, publicSignals } = groth16.fullProve(proverInputs, circuitWasm, circuitKey)

  return {
    proof: {
      a: <string[]>proof.pi_a,
      b: <string[][]>proof.pi_b,
      c: <string[]>proof.pi_c,
      protocol: <string>proof.protocol,
      // curve: <string>proof.curve || "BN254",
    },
    publicSignals: <string[]>publicSignals
  }
}

export function verifyZkProof(verificationKey: { [k: string]: any }, publicSignals: Array<bigint>,
  proof: { a: string, b: string, c: string, protocol: string }): Promise<boolean> {
  const gProof = {
    pi_a: proof.a,
    pi_b: proof.b,
    pi_c: proof.c,
    protocol: proof.protocol,
    // curve: proof.curve,
  }

  return groth16.verify(verificationKey, publicSignals, gProof)
}

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

function digestVotevalue(votes: VoteValues): bigint {
  if (!Array.isArray(votes)) throw new Error("Votes should be an array of numbers")
  const str = "[" + votes.map(value => value.toString(10)).join(",") + "]"
  const hexHash = utils.keccak256(str)

  return BigInt(hexHash) % Poseidon.Q
}
