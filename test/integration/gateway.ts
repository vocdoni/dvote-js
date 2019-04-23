import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, TestAccount, mnemonic } from "../eth-util"
import { Gateway } from "../../src"
import { GatewayMock, InteractionMock, GatewayResponse } from "../mocks/gateway"
import { server as ganacheRpcServer } from "ganache-core"

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
        it("Should create a Gateway instance", async () => {
            const gatewayServer = new GatewayMock({ port, responseList: [] })

            expect(() => {
                const gw1 = new Gateway("")
            }).to.throw

            const gw2 = new Gateway(gatewayUrl)
            expect(await gw2.getUri()).to.equal(gatewayUrl)

            await gatewayServer.stop()
        })
        it("Should update the gateway's URI and point to the new location", async () => {
            const gatewayServer1 = new GatewayMock({ port, responseList: [{ error: false, response: ["OK"] }] })
            expect(gatewayServer1.interactionCount).to.equal(0)
            const gwClient = new Gateway(gatewayUrl)
            expect(await gwClient.getUri()).to.equal(gatewayUrl)
            await gwClient.request({ method: "getVoteStatus", processId: "1234", nullifier: "2345" })

            await gatewayServer1.stop()

            const port2 = 9000
            const gatewayUrl2 = `ws://127.0.0.1:${port2}`

            const gatewayServer2 = new GatewayMock({ port: port2, responseList: [{ error: false, response: ["OK2"] }] })
            expect(gatewayServer2.interactionCount).to.equal(0)
            await gwClient.setGatewayUri(gatewayUrl2)
            expect(await gwClient.getUri()).to.equal(gatewayUrl2)
            await gwClient.request({ method: "getVoteStatus", processId: "5678", nullifier: "6789" })

            await gatewayServer2.stop()

            expect(gatewayServer1.interactionCount).to.equal(1)
            expect(gatewayServer2.interactionCount).to.equal(1)
        })
    })

    describe("WebSocket requests", () => {
        it("Should send messages and provide responses in the right order", async () => {
            const gatewayServer = new GatewayMock({
                port,
                responseList: [
                    { error: false, response: ["OK 1"] },
                    { error: false, response: ["OK 2"] },
                    { error: false, response: ["OK 3"] },
                    { error: false, response: ["OK 4"] },
                    { error: false, response: ["OK 5"] },
                ]
            })
            const gwClient = new Gateway(gatewayUrl)

            const response1 = await gwClient.request({ method: "getVoteStatus", processId: "1234", nullifier: "2345" })
            const response2 = await gwClient.request({ method: "getVoteStatus", processId: "3456", nullifier: "4567" })
            const response3 = await gwClient.request({ method: "getVoteStatus", processId: "5678", nullifier: "6789" })
            const response4 = await gwClient.request({ method: "fetchFile", uri: "12345" })
            const response5 = await gwClient.request({ method: "fetchFile", uri: "67890" })

            expect(response1).to.equal("OK 1")
            expect(response2).to.equal("OK 2")
            expect(response3).to.equal("OK 3")
            expect(response4).to.equal("OK 4")
            expect(response5).to.equal("OK 5")
            expect(gatewayServer.interactionCount).to.equal(5)
            expect(gatewayServer.interactionList[0].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[0].actual.processId).to.equal("1234")
            expect(gatewayServer.interactionList[0].actual.nullifier).to.equal("2345")
            expect(gatewayServer.interactionList[1].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[1].actual.processId).to.equal("3456")
            expect(gatewayServer.interactionList[1].actual.nullifier).to.equal("4567")
            expect(gatewayServer.interactionList[2].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[2].actual.processId).to.equal("5678")
            expect(gatewayServer.interactionList[2].actual.nullifier).to.equal("6789")
            expect(gatewayServer.interactionList[3].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[3].actual.uri).to.equal("12345")
            expect(gatewayServer.interactionList[4].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[4].actual.uri).to.equal("67890")

            await gatewayServer.stop()
        })
        it("Should provide an encrypted channel to communicate with clients")
        it("Should report errors and throw them as an error", async () => {
            const gatewayServer = new GatewayMock({
                port,
                responseList: [
                    { error: true, response: ["ERROR 1"] },
                    { error: true, response: ["ERROR 2"] },
                    { error: true, response: ["ERROR 3"] },
                    { error: true, response: ["ERROR 4"] },
                    { error: true, response: ["ERROR 5"] },
                ]
            })
            const gwClient = new Gateway(gatewayUrl)

            try {
                await gwClient.request({ method: "getVoteStatus", processId: "1234", nullifier: "2345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 1")
            }
            try {
                await gwClient.request({ method: "getVoteStatus", processId: "3456", nullifier: "4567" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 2")
            }
            try {
                await gwClient.request({ method: "getVoteStatus", processId: "5678", nullifier: "6789" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 3")
            }
            try {
                await gwClient.request({ method: "fetchFile", uri: "12345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 4")
            }
            try {
                await gwClient.request({ method: "fetchFile", uri: "67890" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 5")
            }

            expect(gatewayServer.interactionCount).to.equal(5)
            expect(gatewayServer.interactionList[0].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[0].actual.processId).to.equal("1234")
            expect(gatewayServer.interactionList[0].actual.nullifier).to.equal("2345")
            expect(gatewayServer.interactionList[1].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[1].actual.processId).to.equal("3456")
            expect(gatewayServer.interactionList[1].actual.nullifier).to.equal("4567")
            expect(gatewayServer.interactionList[2].actual.method).to.equal("getVoteStatus")
            expect(gatewayServer.interactionList[2].actual.processId).to.equal("5678")
            expect(gatewayServer.interactionList[2].actual.nullifier).to.equal("6789")
            expect(gatewayServer.interactionList[3].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[3].actual.uri).to.equal("12345")
            expect(gatewayServer.interactionList[4].actual.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[4].actual.uri).to.equal("67890")

            await gatewayServer.stop()
        })
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

            await gatewayServer.stop()
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

            await gatewayServer.stop()
        })
        it("Should request to unpin an old file")
        it("Should list the currently pinned files")
        it("Should enforce authenticated upload requests", async () => {
            const base64File = "ZGVjZW50cmFsaXplZA=="

            // Gateway (server)
            const gatewayServer = new GatewayMock({ port, responseList: [] })

            // Client
            try {
                const gw = new Gateway(gatewayUrl)
                await new Promise(resolve => setTimeout(resolve, 10))
                await gw.addFile(base64File, "swarm", null)
                throw new Error("Should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.equal("Invalid wallet")
            }

            expect(gatewayServer.interactionCount).to.equal(0)

            await gatewayServer.stop()
        })
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

            await gatewayServer.stop()
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

            await gatewayServer.stop()
        })
        it("Should request to unpin an old file")
        it("Should list the currently pinned files")
        it("Should enforce authenticated upload requests", async () => {
            const base64File = "ZGVjZW50cmFsaXplZA=="

            // Gateway (server)
            const gatewayServer = new GatewayMock({ port, responseList: [] })

            // Client
            try {
                const gw = new Gateway(gatewayUrl)
                await new Promise(resolve => setTimeout(resolve, 10))
                await gw.addFile(base64File, "ipfs", null)
                throw new Error("Should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.equal("Invalid wallet")
            }

            expect(gatewayServer.interactionCount).to.equal(0)

            await gatewayServer.stop()
        })
        it("Should enforce authenticated unpin requests")
    })

    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC provider to interact with the blockchain", async () => {
            // Web socket server
            const webSocketServer = new GatewayMock({ port, responseList: [] })

            // Web3 node
            const rpcServer = ganacheRpcServer()
            const info: any = await new Promise(resolve => rpcServer.listen(8545, (err, info) => resolve(info)))

            expect(Object.keys(info.personal_accounts).length).to.be.approximately(10, 9)
            expect(Object.keys(info.personal_accounts)[0]).to.match(/^0x[0-9a-fA-F]{40}$/)

            const addr = Object.keys(info.personal_accounts)[0]

            const gw = new Gateway(gatewayUrl)
            const gwProvider = await gw.getEthereumProvider()
            const balance = await gwProvider.getBalance(addr)

            expect(balance.toHexString()).to.match(/^0x[0-9a-fA-F]{10,}$/)

            webSocketServer.stop()
            rpcServer.close()
        })
    })

})
