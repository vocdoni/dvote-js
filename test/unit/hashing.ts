import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Poseidon } from "../../src/crypto/hashing"

addCompletionHooks()

describe("Poseidon", () => {

  it("Should hash big int's", () => {
    const items = [
      {
        input: BigInt("1"),
        output: BigInt('18586133768512220936620570745912940619677854269274689475585506675881198879027')
      },
      {
        input: BigInt("18586133768512220936620570745912940619677854269274689475585506675881198879027"),
        output: BigInt('17744324452969507964952966931655538206777558023197549666337974697819074895989')
      },
    ]

    items.forEach(item => {
      expect(Poseidon.hash([item.input])).to.eq(item.output)
    })
  })

  it("Should fail when out of the field", () => {
    const items = [
      BigInt("-1"),
      Poseidon.Q,
      Poseidon.Q + BigInt("1"),
    ]
    items.forEach(item => {
      try {
        Poseidon.hash([item])
      }
      catch (err) {
        expect(err.message).to.eq("One or more inputs are out of the Poseidon field")
      }
    })
  })
})
