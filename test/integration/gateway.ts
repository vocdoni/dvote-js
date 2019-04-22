import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, TestAccount } from "../eth-util"
import { Gateway } from "../../src"
import { GatewayMock, InteractionMock, GatewayResponse } from "../mocks/gateway"

const port = 8000
const gatewayUrl = `ws://localhost:${port}`

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount

addCompletionHooks()

describe("Gateway", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
    })

    describe("Lifecycle", () => {
        it("Should create a Gateway instance")
        it("Should update the gateway's URI and point to the new location")
    })

    describe("WebSocket requests", () => {
        it("Should send messages and provide responses")
        it("Should provide the results that match the corresponding message request")
        it("Should provide an encrypted channel to communicate with clients")
    })

    describe("Swarm", () => {
        it("Should upload a file", async () => {
            const base64File = "dm9jZG9uaQ=="

            // Gateway (server)
            const responseList: GatewayResponse[] = [{ error: false, response: ["bzz://1234"] }]
            const gatewayServer = new GatewayMock({ port, responseList })

            // Client
            const gw = new Gateway(gatewayUrl)
            const result1 = await gw.addFile(base64File, "swarm", baseAccount.wallet)

            expect(gatewayServer.interactionCount).to.equal(1)
            expect(gatewayServer.interactionList[0].actual.method).to.equal("addFile")
            expect(gatewayServer.interactionList[0].actual.type).to.equal("swarm")
            expect(gatewayServer.interactionList[0].actual.content).to.equal(base64File)
            expect(gatewayServer.interactionList[0].actual.address).to.equal(baseAccount.address)
            expect(gatewayServer.interactionList[0].actual.requestId).to.match(/^0x[0-9a-fA-F]{64}$/)
            expect(gatewayServer.interactionList[0].actual.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

            expect(result1.length).to.be.ok
            expect(result1).to.equal("bzz://1234")

            gatewayServer.stop()
        })
        it("Should retrieve a pinned file", async () => {
            const base64File = "dm9jZG9uaQ=="

            // Gateway (server)
            const responseList: GatewayResponse[] = [
                { error: false, response: ["bzz://2345"] },
                { error: false, response: [base64File] }
            ]
            const gatewayServer = new GatewayMock({ port, responseList })

            // Client
            const gw = new Gateway(gatewayUrl)
            const result1 = await gw.addFile(base64File, "swarm", baseAccount.wallet)
            expect(result1).to.equal("bzz://2345")

            expect(gatewayServer.interactionCount).to.equal(1)

            const result2 = await gw.fetchFile(result1)
            expect(result2).to.equal(base64File)

            expect(gatewayServer.interactionCount).to.equal(2)
            expect(gatewayServer.interactionList[1].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[1].actual.uri).to.equal(result1)
            expect(gatewayServer.interactionList[1].actual.requestId).to.match(/^0x[0-9a-fA-F]{64}$/)

            gatewayServer.stop()
        })
        it("Should unpin an old file")
        it("Should enforce authenticated upload requests")
        it("Should enforce authenticated unpin requests")
    })

    describe("IPFS", () => {
        it("Should upload a file", async () => {
            const base64File = "ZGVjZW50cmFsaXplZA=="

            // Gateway (server)
            const responseList: GatewayResponse[] = [{ error: false, response: ["ipfs://ipfs/1234"] }]
            const gatewayServer = new GatewayMock({ port, responseList })

            // Client
            const gw = new Gateway(gatewayUrl)
            const result1 = await gw.addFile(base64File, "ipfs", baseAccount.wallet)

            expect(gatewayServer.interactionCount).to.equal(1)
            expect(gatewayServer.interactionList[0].actual.method).to.equal("addFile")
            expect(gatewayServer.interactionList[0].actual.type).to.equal("ipfs")
            expect(gatewayServer.interactionList[0].actual.content).to.equal(base64File)
            expect(gatewayServer.interactionList[0].actual.address).to.equal(baseAccount.address)
            expect(gatewayServer.interactionList[0].actual.requestId).to.match(/^0x[0-9a-fA-F]{64}$/)
            expect(gatewayServer.interactionList[0].actual.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

            expect(result1.length).to.be.ok
            expect(result1).to.equal("ipfs://ipfs/1234")

            gatewayServer.stop()
        })
        it("Should retrieve a pinned file", async () => {
            const base64File = "ZGVjZW50cmFsaXplZA=="

            // Gateway (server)
            const responseList: GatewayResponse[] = [
                { error: false, response: ["ipfs://ipfs/2345"] },
                { error: false, response: [base64File] }
            ]
            const gatewayServer = new GatewayMock({ port, responseList })

            // Client
            const gw = new Gateway(gatewayUrl)
            const result1 = await gw.addFile(base64File, "ipfs", baseAccount.wallet)
            expect(result1).to.equal("ipfs://ipfs/2345")

            expect(gatewayServer.interactionCount).to.equal(1)

            const result2 = await gw.fetchFile(result1)
            expect(result2).to.equal(base64File)

            expect(gatewayServer.interactionCount).to.equal(2)
            expect(gatewayServer.interactionList[1].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[1].actual.uri).to.equal(result1)
            expect(gatewayServer.interactionList[1].actual.requestId).to.match(/^0x[0-9a-fA-F]{64}$/)

            gatewayServer.stop()
        })
        it("Should unpin an old file")
        it("Should enforce authenticated upload requests")
        it("Should enforce authenticated unpin requests")
    })

    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC endpoint to interact with the blockchain")
        it("Should allow to call contract data")
        it("Should allow to send signed transactions from a funded account")
    })

})
