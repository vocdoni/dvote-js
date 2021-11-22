import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { Keccak256 } from "../../src"

addCompletionHooks()

describe("Keccak256 hashing", () => {
    it("Should hash a text", () => {
        const text = "This is an example"

        const hash = Keccak256.hashText(text)
        expect(hash).to.eq("0x041a34ca22b57f8355a7995e261fded7a10f6b2c634fb9f6bfdbdafcbf556840")
    })
    it("Should hash a hex text", () => {
        const hex = "0xAAAA"

        const hash = Keccak256.hashHexString(hex)
        expect(hash).to.eq("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
    })
    it("Should hash bytes", () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5])

        const hash = Keccak256.hashBytes(bytes)
        expect(hash).to.eq("0x7d87c5ea75f7378bb701e404c50639161af3eff66293e9f375b5f17eb50476f4")
    })
})
