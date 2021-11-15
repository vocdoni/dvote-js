import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { Random } from "../../src"

addCompletionHooks()

describe("Random generation", () => {
    it("Should generate a random buffer from given length", () => {
        const bytes = Random.getBytes(8)

        expect(bytes).to.be.instanceof(Uint8Array)
        expect(bytes.length).to.eq(8)
    })
    it("Should generate a random hex", () => {
        const hex = Random.getHex()

        expect(hex).to.be.a("string")
        expect(hex.substr(0, 2)).to.eq("0x")
        expect(hex.slice(2).length).to.eq(64)
    })
    it("Should generate a random bigint", () => {
        const bigint = Random.getBigInt(BigInt(256))

        expect(bigint).to.be.a("bigint")
    })
    it("Should shuffle an array in random order", () => {
        const nums = [1, 2, 3, 4]
        const shuffle = Random.shuffle(nums)

        expect(shuffle).to.be.a("array")
        expect(shuffle.length).to.eq(nums.length)
        expect(shuffle).to.have.members(nums)
    })
})
