import "mocha" // using @types/mocha
import { expect } from "chai"

describe("Voting Process", () => {

    describe("Process metadata", () => {
        it("Should fetch the metadata of a voting process")
        it("Should allow to upload the JSON metadata of a new Voting Process")
        it("Should register a new voting process on the blockchain")
        it("Should fail creating a process if the Entity does not exist")
        it("Should return the processId after creating it")
    })

    // describe("Linkable Ring Signatures", () => {
    //     it("Should fetch the given ring (modulus group) from the census service")
    //     it("Should submit a Vote Envelope to a Gateway")
    //     it("Should request the status of a vote to a Gateway and provide a response")
    // })

    describe("ZK Snarks", () => {
        it("Should fetch the census Merkle Proof from the census service")
        it("Should submit a Vote Envelope to a Gateway")
        it("Should request the status of a vote to a Gateway and provide a response")
    })

    describe("Vote batches", () => {
        it("Should fetch a vote batch registered in a voting process")
    })

})
