import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { Proof, Tx, VoteEnvelope } from "../../src/protobuf"
import { wrapRawTransaction } from "../../src/raw-tx"

addCompletionHooks()

describe("Raw transaction", () => {
  it("Should wrap raw transactions", () => {
    const inputs = [
      {
        input: Tx.encode({
          payload: {
            $case: "vote", vote: VoteEnvelope.fromPartial({
              encryptionKeyIndexes: [],
              nonce: new Uint8Array([]),
              nullifier: new Uint8Array(),
              processId: new Uint8Array(),
              proof: Proof.fromPartial({}),
              votePackage: new Uint8Array()
            })
          }
        }),
        output: "CgYKBBoAMgASAA==",
      },
      {
        input: Tx.encode({
          payload: {
            $case: "vote", vote: VoteEnvelope.fromPartial({
              encryptionKeyIndexes: [1, 2, 3],
              nonce: new Uint8Array([0, 1, 2, 3, 4, 5]),
              nullifier: new Uint8Array([10, 11, 12, 13, 14, 15]),
              processId: new Uint8Array([20, 21, 22, 23, 24, 25]),
              proof: Proof.fromPartial({ payload: { $case: "arbo", arbo: { siblings: new Uint8Array(), type: 0, value: new Uint8Array() } } }),
              votePackage: new Uint8Array()
            })
          }
        }),
        output: "CiMKIQoGAAECAwQFEgYUFRYXGBkaAjIAKgYKCwwNDg8yAwECAxIA",
      },
    ]

    for (const item of inputs) {
      const result = wrapRawTransaction(item.input.finish())
      expect(result.method).to.equal("submitRawTx")
      expect(result.payload).to.equal(item.output)
    }
  })

  it("Should wrap raw transactions with a signature", () => {
    const inputs = [
      {
        input: Tx.encode({
          payload: {
            $case: "vote", vote: VoteEnvelope.fromPartial({
              encryptionKeyIndexes: [],
              nonce: new Uint8Array([]),
              nullifier: new Uint8Array(),
              processId: new Uint8Array(),
              proof: Proof.fromPartial({}),
              votePackage: new Uint8Array()
            })
          }
        }),
        signature: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        output: "CgYKBBoAMgASCAECAwQFBgcI",
      },
      {
        input: Tx.encode({
          payload: {
            $case: "vote", vote: VoteEnvelope.fromPartial({
              encryptionKeyIndexes: [1, 2, 3],
              nonce: new Uint8Array([0, 1, 2, 3, 4, 5]),
              nullifier: new Uint8Array([10, 11, 12, 13, 14, 15]),
              processId: new Uint8Array([20, 21, 22, 23, 24, 25]),
              proof: Proof.fromPartial({ payload: { $case: "arbo", arbo: { siblings: new Uint8Array(), type: 0, value: new Uint8Array() } } }),
              votePackage: new Uint8Array()
            })
          }
        }),
        signature: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        output: "CiMKIQoGAAECAwQFEgYUFRYXGBkaAjIAKgYKCwwNDg8yAwECAxIIAQIDBAUGBwg=",
      },
    ]

    for (const item of inputs) {
      const result = wrapRawTransaction(item.input.finish(), item.signature)
      expect(result.method).to.equal("submitRawTx")
      expect(result.payload).to.equal(item.output)
    }
  })
})
