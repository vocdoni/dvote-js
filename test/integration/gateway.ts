import "mocha" // using @types/mocha
import { expect } from "chai"

describe("Gateway", () => {

    describe("Swarm", () => {
        it("Should upload a file")
        it("Should enforce authenticated upload requests")
        it("Should retrieve a pinned file")
        it("Should unpin an old file")
        it("Should enforce authenticated unpin requests")
    })

    describe("IPFS", () => {
        it("Should upload a file")
        it("Should enforce authenticated upload requests")
        it("Should retrieve a pinned file")
        it("Should unpin an old file")
        it("Should enforce authenticated unpin requests")
    })

    describe("WebSocket requests", () => {
        it("Should send messages")
        it("Should reply with responses")
        it("Should provide the results that match the corresponding message request")
    })

    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC endpoint to interact with the blockchain")
        it("Should allow to call contract data")
        it("Should allow to send signed transactions from a funded account")
    })

    describe("Lifecycle", () => {
        it("Should create a Gateway instance")
        it("Should update the gateway's URI and point to the new location")
    })

})
