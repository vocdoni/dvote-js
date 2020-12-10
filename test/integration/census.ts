import "mocha" // using @types/mocha
import { expect } from "chai"

describe("Census", () => {

    describe("Graviton censusees", () => {
        it("Should allow to add a claim to a census")
        it("Should allow to add a set of claims to a census")
        it("Should request and provide the Merkle root of a census (ZK)")
        it("Should fetch the Merkle proof of an account within a census")
        it("Should allow to dump a given census")
        it("Only signed requests from whitelisted accounts should be able to add claims")
        it("Only signed requests from whitelisted accounts should be able to dump a census")
    })

    describe("ERC20 based censuses", () => {
        it("Should register a token")
        it("Should retrieve a token status on the contract")
        it("Should generate a proof")
        it("Should verify a proof")
        it("Should get the balance of a holder")
        it("Should get the balance mapping position")
    })

})
