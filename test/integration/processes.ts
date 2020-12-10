import "mocha" // using @types/mocha
import { expect } from "chai"
import DevServices from "../helpers/all-services"
import { Gateway } from "../../src/net/gateway"
import EnsResolverBuilder from "../builders/ens-resolver"
import NamespaceBuilder, { DEFAULT_NAMESPACE } from "../builders/namespace"
import ProcessBuilder, { DEFAULT_PARAMS_SIGNATURE } from "../builders/process"
// import { ProcessMetadata } from "../../src/models/process"
// import { VotingApi } from "../../src/api/voting"
import { Wallet } from "ethers"
// import { ProcessContractParameters, ProcessMode, ProcessEnvelopeType } from "../../src/net/contracts"
// import { EntityMetadataTemplate } from "../../src/models/entity"

let server: DevServices
let gateway: Gateway
let entityAccount: Wallet

describe("Process", () => {
    before(() => {
        server = new DevServices()
        return server.start()
    })
    after(() => server.stop())

    beforeEach(async () => {
        const entityInstance = await new EnsResolverBuilder(server.accounts).build()
        const namespaceInstance = await new NamespaceBuilder(server.accounts).build()
        const processInstance = await new ProcessBuilder(server.accounts).build(0)
        gateway = await server.getGateway(entityInstance.address, namespaceInstance.address, processInstance.address)

        entityAccount = server.web3.accounts[1].wallet
    })

    // it("example", async () => {
    //     const gatewayServer = new GatewayMock({
    //         port,
    //         responses: [
    //             { ok: true, request: "123", timestamp: 123, result: "OK 1" },
    //             { ok: true, request: "234", timestamp: 234, result: "OK 2" },
    //         ]
    //     })
    //     const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
    //     const gwClient = new DVoteGateway(gatewayInfo)
    //     await gwClient.connect()

    //     const response1 = await gwClient.sendRequest({ method: "addCensus", processId: "1234", nullifier: "2345" })
    //     const response2 = await gwClient.sendRequest({ method: "addClaim", processId: "3456", nullifier: "4567" })

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
        it("Should register a new process on the blockchain")
        //     it("Should register a new process on the blockchain", async () => {

        //     const params = {
        //         mode: ProcessMode.AUTO_START,
        //         envelopeType: ProcessEnvelopeType.make(),
        //         // metadata not needed
        //         censusMerkleRoot: "0x1",
        //         censusMerkleTree: "ipfs://1234",
        //         startBlock: 200,
        //         blockCount: 1000,
        //         maxCount: 1,
        //         maxValue: 5,
        //         maxTotalCost: 10,
        //         maxVoteOverwrites: 0,
        //         uniqueValues: true,
        //         costExponent: 10000,
        //         questionCount: 5, /////
        //         namespace: DEFAULT_NAMESPACE,
        //         paramsSignature: DEFAULT_PARAMS_SIGNATURE
        //     }
        //     const metadata: ProcessMetadata = {
        //         version: "1.1",
        //         title: { default: "test" },
        //         description: { default: "test" },
        //         media: {
        //             header: "header"
        //         },
        //         questions: [{
        //             title: { default: "title" },
        //             description: { default: "description" },
        //             choices: [
        //                 { title: { default: "Yes" }, value: 0 },
        //                 { title: { default: "No" }, value: 1 },
        //             ]
        //         }]
        //     }

        //     server.dvote.addResponse({ ok: true, content: Buffer.from(EntityMetadataTemplate).toString("base64") }) // internal getMetadata > fetchFile
        //     server.dvote.addResponse({ ok: true, ... }) // fetchFile
        //     const processId = await newProcess(params, metadata, entityAccount, gateway)
        // })


        it("Should fetch the metadata of a process")
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
