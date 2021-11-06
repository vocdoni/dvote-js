// @ts-ignore  
import { groth16 } from "snarkjs"
import { ensure0x, strip0x } from "../util/hex"
import { VoteValues } from "../common"
import { utils } from "ethers"

export type ZkInputs = {
  processId: string
  /** hex string */
  censusRoot: string
  /** hex strings */
  censusSiblings: string[]
  secretKey: bigint
  votes: VoteValues
  /** hex string */
  nullifier: string
}

type ZkReturn = {
  proof: {
    a: string[]
    b: string[][]
    c: string[]
    protocol: string
    // curve: <string>proof.curve || "bn128",
  },
  publicSignals: string[]
}

export function getZkProof(input: ZkInputs, circuitWasm: Uint8Array, zKey: Uint8Array): Promise<ZkReturn> {
  const voteValue = digestVoteValue(input.votes)

  const proverInputs = {
    censusRoot: BigInt(ensure0x(input.censusRoot)),
    censusSiblings: input.censusSiblings.map(item => BigInt(ensure0x(item))),
    secretKey: input.secretKey,
    voteValue,
    electionId: BigInt(ensure0x(input.processId)),
    nullifier: BigInt(ensure0x(input.nullifier))
  }
  return groth16.fullProve(proverInputs, circuitWasm, zKey)
    .then(result => {
      if (!result) throw new Error("The ZK proof could not be generated")
      const { proof, publicSignals } = result

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
    })
    .catch(err => {
      throw new Error("The ZK proof could not be generated")
    })
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

function digestVoteValue(votes: VoteValues): [bigint, bigint] {
  // TODO: confirm serialization method
  const strVotes = votes.map(v => v.toString()).join(",")  // 1234,2345,3456,4567,5678
  const strVotesBytes = Buffer.from(strVotes, "utf-8")
  const hexHashed = strip0x(utils.keccak256(strVotesBytes))
  return [
    // little-endian BigInt representations
    BigInt("0x" + hexHashed.slice(0, 32).match(/.{2}/g).reverse().join("")),
    BigInt("0x" + hexHashed.slice(32, 64).match(/.{2}/g).reverse().join(""))
  ]
}
