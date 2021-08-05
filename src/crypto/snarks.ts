// @ts-ignore  
import { groth16 } from "snarkjs"
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
  const voteValues = input.votes.map(num => typeof num == "bigint" ? num : BigInt(num))

  const proverInputs = {
    censusRoot: BigInt(ensure0x(input.censusRoot)),
    censusSiblings: input.censusSiblings.map(item => BigInt(ensure0x(item))),
    secretKey: input.secretKey,
    voteValues,
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
      // curve: <string>proof.curve || "bn128",
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
