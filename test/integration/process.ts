import "mocha" // using @types/mocha
import { expect } from "chai"

describe("Process", () => {
    // it("example", async () => {
    //     const gatewayServer = new GatewayMock({
    //         port,
    //         responses: [
    //             { id: "123", response: { ok: true, request: "123", timestamp: 123, result: "OK 1" }, signature: "123" },
    //             { id: "234", response: { ok: true, request: "234", timestamp: 234, result: "OK 2" }, signature: "234" },
    //         ]
    //     })
    //     const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
    //     const gwClient = new DVoteGateway(gatewayInfo)
    //     await gwClient.connect()

    //     const response1 = await gwClient.sendMessage({ method: "addCensus", processId: "1234", nullifier: "2345" })
    //     const response2 = await gwClient.sendMessage({ method: "addClaim", processId: "3456", nullifier: "4567" })

    //     expect(response1.result).to.equal("OK 1")
    //     expect(response2.result).to.equal("OK 2")
    //     expect(gatewayServer.interactionCount).to.equal(5)
    //     expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addCensus")
    //     expect(gatewayServer.interactionList[0].actual.request.processId).to.equal("1234")
    //     expect(gatewayServer.interactionList[0].actual.request.nullifier).to.equal("2345")
    //     expect(gatewayServer.interactionList[1].actual.request.method).to.equal("addClaim")
    //     expect(gatewayServer.interactionList[1].actual.request.processId).to.equal("3456")
    //     expect(gatewayServer.interactionList[1].actual.request.nullifier).to.equal("4567")
    //     expect(gatewayServer.interactionList[2].actual.request.method).to.equal("addClaimBulk")
    //     expect(gatewayServer.interactionList[2].actual.request.processId).to.equal("5678")
    //     expect(gatewayServer.interactionList[2].actual.request.nullifier).to.equal("6789")
    //     expect(gatewayServer.interactionList[3].actual.request.method).to.equal("fetchFile")
    //     expect(gatewayServer.interactionList[3].actual.request.uri).to.equal("12345")
    //     expect(gatewayServer.interactionList[4].actual.request.method).to.equal("fetchFile")
    //     expect(gatewayServer.interactionList[4].actual.request.uri).to.equal("67890")

    //     await gatewayServer.stop()
    // })

    describe("Process metadata", () => {
        it("Should fetch the metadata of a voting process")
        it("Should allow to upload the JSON metadata of a new Voting Process")
        it("Should register a new voting process on the blockchain")
        it("Should fail creating a process if the Entity does not exist")
        it("Should return the processId after creating it")
    })

    describe("Votes", () => {
        it("Should fetch the census Merkle Proof from the census service")
        it("Should submit a Vote Envelope to a Gateway")
        it("Should request the status of a vote to a Gateway and provide a response")
    })

    describe("Vote batches", () => {
        it("Should fetch a vote batch registered in a process")
    })
})
