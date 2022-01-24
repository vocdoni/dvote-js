import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Random } from "@vocdoni/common"

addCompletionHooks()

describe("Standalone Ethereum wallets", () => {
    it("Should generate a new random seed for a standalone wallet", () => {
        const seed1 = Random.getHex()
        const seed2 = Random.getHex()
        const seed3 = Random.getHex()
        const seed4 = Random.getHex()

        expect(seed1.length).to.eq(66)
        expect(seed2.length).to.eq(66)
        expect(seed3.length).to.eq(66)
        expect(seed4.length).to.eq(66)

        expect(seed1.substring(0, 2)).to.eq('0x')
        expect(seed2.substring(0, 2)).to.eq('0x')
        expect(seed3.substring(0, 2)).to.eq('0x')
        expect(seed4.substring(0, 2)).to.eq('0x')

        expect(seed1.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed2.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed3.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed4.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok

        expect(seed1).to.be.not.eq(seed2)
        expect(seed1).to.be.not.eq(seed3)
        expect(seed1).to.be.not.eq(seed4)
        expect(seed2).to.be.not.eq(seed3)
        expect(seed2).to.be.not.eq(seed4)
        expect(seed3).to.be.not.eq(seed4)
    })
})
