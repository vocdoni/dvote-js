// @ts-ignore  
import { groth16 } from "snarkjs"
import { ensure0x } from "../util/hex"
import { bufferLeToBigInt, hexStringToBuffer } from "../util/encoding"
import { sha256 } from "@ethersproject/sha2"

export type ZkInputs = {
  processId: [bigint, bigint]
  /** hex string */
  censusRoot: string
  /** hex strings */
  censusSiblings: bigint[]
  keyIndex: bigint
  secretKey: bigint
  votePackage: Uint8Array
  /** hex string */
  nullifier: bigint
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

export function getZkProof(input: ZkInputs, witnessGeneratorWasm: Uint8Array, zKey: Uint8Array): Promise<ZkReturn> {
  const voteHash = digestVotePackage(input.votePackage)

  const proverInputs = {
    censusRoot: BigInt(ensure0x(input.censusRoot)),
    censusSiblings: input.censusSiblings,
    secretKey: input.secretKey,
    index: input.keyIndex,
    voteHash,
    processId: input.processId,
    nullifier: input.nullifier
  }
  return groth16.fullProve(proverInputs, witnessGeneratorWasm, zKey)
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

export function digestVotePackage(votePackage: Uint8Array): [bigint, bigint] {
  const hexHashed = sha256(votePackage)
  const buffHashed = hexStringToBuffer(hexHashed)
  return [
    bufferLeToBigInt(buffHashed.slice(0, 16)),
    bufferLeToBigInt(buffHashed.slice(16, 32)),
  ]
}
