import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, TestAccount } from "../helpers/all-services"
import { DVoteGateway, Web3Gateway, IDVoteGateway, Gateway, IGateway } from "../../src/net/gateway"
import { addFile, fetchFileBytes } from "../../src/api/file"
import { DevWebSocketServer, WebSocketMockedInteraction, WSResponse, WSResponseBody } from "../helpers/web-socket-service"
import { Buffer } from "buffer"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { DevWeb3Service } from "../helpers/web3-service"

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let port: number

const defaultDummyResponse = { ok: true }

addCompletionHooks()

describe("DVote gateway client", () => {
    beforeEach(() => {
        port = 8500
    })

    describe("Lifecycle", () => {
        it("Should create a DVoteGateway instance", async () => {
            const wsServer = new DevWebSocketServer()
            const gatewayInfo = wsServer.gatewayInfo

            expect(() => {
                new DVoteGateway({ uri: "", supportedApis: [], publicKey: "" })
            }).to.throw

            const gw2 = new DVoteGateway(gatewayInfo)
            await gw2.connect()

            expect(await gw2.getUri()).to.equal(gatewayInfo.dvote)

            gw2.disconnect()
            await wsServer.stop()
        })

        it("Should update the gateway's URI and point to the new location", async () => {
            const port1 = port + 1
            const gatewayUri1 = `ws://127.0.0.1:${port1}`
            const wsServer1 = new DevWebSocketServer({ port: port1, responses: [defaultDummyResponse] })
            expect(wsServer1.interactionCount).to.equal(0)

            const gatewayInfo1 = new GatewayInfo(gatewayUri1, ["file", "vote", "census"], "https://server/path", "")
            let gwClient = new DVoteGateway(gatewayInfo1)
            expect(await gwClient.getUri()).to.equal(gatewayInfo1.dvote)
            await gwClient.connect()
            await gwClient.sendRequest({ method: "addClaim", processId: "1234", nullifier: "2345" })

            await gwClient.disconnect()
            await wsServer1.stop()

            const port2 = 9000
            const gatewayUri2 = `ws://127.0.0.1:${port2}`
            const gatewayInfo2 = new GatewayInfo(gatewayUri2, ["file", "vote", "census"], "https://server/path", "")

            const wsServer2 = new DevWebSocketServer({ port: port2, responses: [defaultDummyResponse] })
            expect(wsServer2.interactionCount).to.equal(0)

            gwClient = new DVoteGateway(gatewayInfo2)
            await gwClient.connect()
            expect(await gwClient.getUri()).to.equal(gatewayInfo2.dvote)
            await gwClient.sendRequest({ method: "addClaim", processId: "5678", nullifier: "6789" })

            await gwClient.disconnect()
            await wsServer2.stop()

            expect(wsServer1.interactionCount).to.equal(2)
            expect(wsServer2.interactionCount).to.equal(2)
        })
    })

    describe("WebSocket requests", () => {
        it("Should send messages and provide responses in the right order", async () => {
            const wsServer = new DevWebSocketServer({
                port,
                responses: [
                    { ok: true, result: "OK 1" },
                    { ok: true, result: "OK 2" },
                    { ok: true, result: "OK 3" },
                    { ok: true, result: "OK 4" },
                    { ok: true, result: "OK 5" },
                ]
            })
            const gatewayInfo = wsServer.gatewayInfo
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.connect()

            const response1 = await gwClient.sendRequest({ method: "addCensus", processId: "1234", nullifier: "2345" })
            const response2 = await gwClient.sendRequest({ method: "addClaim", processId: "3456", nullifier: "4567" })
            const response3 = await gwClient.sendRequest({ method: "addClaimBulk", processId: "5678", nullifier: "6789" })
            const response4 = await gwClient.sendRequest({ method: "fetchFile", uri: "12345" })
            const response5 = await gwClient.sendRequest({ method: "fetchFile", uri: "67890" })

            expect(response1.result).to.equal("OK 1")
            expect(response2.result).to.equal("OK 2")
            expect(response3.result).to.equal("OK 3")
            expect(response4.result).to.equal("OK 4")
            expect(response5.result).to.equal("OK 5")
            expect(wsServer.interactionCount).to.equal(5)
            expect(wsServer.interactionList[0].requested.request.method).to.equal("addCensus")
            expect(wsServer.interactionList[0].requested.request.processId).to.equal("1234")
            expect(wsServer.interactionList[0].requested.request.nullifier).to.equal("2345")
            expect(wsServer.interactionList[1].requested.request.method).to.equal("addClaim")
            expect(wsServer.interactionList[1].requested.request.processId).to.equal("3456")
            expect(wsServer.interactionList[1].requested.request.nullifier).to.equal("4567")
            expect(wsServer.interactionList[2].requested.request.method).to.equal("addClaimBulk")
            expect(wsServer.interactionList[2].requested.request.processId).to.equal("5678")
            expect(wsServer.interactionList[2].requested.request.nullifier).to.equal("6789")
            expect(wsServer.interactionList[3].requested.request.method).to.equal("fetchFile")
            expect(wsServer.interactionList[3].requested.request.uri).to.equal("12345")
            expect(wsServer.interactionList[4].requested.request.method).to.equal("fetchFile")
            expect(wsServer.interactionList[4].requested.request.uri).to.equal("67890")

            await wsServer.stop()
        })
        it("Should provide an encrypted channel to communicate with clients")
        it("Should report errors and throw them as an error", async () => {
            const wsServer = new DevWebSocketServer()
            const gatewayInfo = wsServer.gatewayInfo
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.connect()

            wsServer.addResponse({ ok: false, message: "ERROR 1" })
            wsServer.addResponse({ ok: false, message: "ERROR 2" })
            wsServer.addResponse({ ok: false, message: "ERROR 3" })
            wsServer.addResponse({ ok: false, message: "ERROR 4" })
            wsServer.addResponse({ ok: false, message: "ERROR 5" })

            try {
                await gwClient.sendRequest({ method: "addCensus", processId: "1234", nullifier: "2345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 1")
            }
            try {
                await gwClient.sendRequest({ method: "addCensus", processId: "3456", nullifier: "4567" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 2")
            }
            try {
                await gwClient.sendRequest({ method: "addCensus", processId: "5678", nullifier: "6789" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 3")
            }
            try {
                await gwClient.sendRequest({ method: "fetchFile", uri: "12345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 4")
            }
            try {
                await gwClient.sendRequest({ method: "fetchFile", uri: "67890" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 5")
            }

            expect(wsServer.interactionCount).to.equal(5)
            expect(wsServer.interactionList[0].requested.request.method).to.equal("addCensus")
            expect(wsServer.interactionList[0].requested.request.processId).to.equal("1234")
            expect(wsServer.interactionList[0].requested.request.nullifier).to.equal("2345")
            expect(wsServer.interactionList[1].requested.request.method).to.equal("addCensus")
            expect(wsServer.interactionList[1].requested.request.processId).to.equal("3456")
            expect(wsServer.interactionList[1].requested.request.nullifier).to.equal("4567")
            expect(wsServer.interactionList[2].requested.request.method).to.equal("addCensus")
            expect(wsServer.interactionList[2].requested.request.processId).to.equal("5678")
            expect(wsServer.interactionList[2].requested.request.nullifier).to.equal("6789")
            expect(wsServer.interactionList[3].requested.request.method).to.equal("fetchFile")
            expect(wsServer.interactionList[3].requested.request.uri).to.equal("12345")
            expect(wsServer.interactionList[4].requested.request.method).to.equal("fetchFile")
            expect(wsServer.interactionList[4].requested.request.uri).to.equal("67890")

            await wsServer.stop()
        })
    })

    describe("IPFS", () => {
        it("Should upload a file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            const wsServer = new DevWebSocketServer()

            // Client
            const gatewayInfo = wsServer.gatewayInfo
            const gw = new DVoteGateway(gatewayInfo)
            await gw.connect()

            wsServer.addResponse({ ok: true, uri: "ipfs://1234" })

            const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)

            expect(wsServer.interactionCount).to.equal(1)
            expect(wsServer.interactionList[0].requested.request.method).to.equal("addFile")
            expect(wsServer.interactionList[0].requested.request.type).to.equal("ipfs")
            expect(wsServer.interactionList[0].requested.request.content).to.equal(buffData.toString("base64"))
            expect(wsServer.interactionList[0].requested.id).to.match(/^[0-9a-fA-F]{10}$/)
            expect(wsServer.interactionList[0].requested.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

            expect(result1.length).to.be.ok
            expect(result1).to.equal("ipfs://1234")

            gw.disconnect()
            await wsServer.stop()
        })

        it("Should retrieve a pinned file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            const responses: WSResponseBody[] = [
                { ok: true, uri: "ipfs://2345" },
                { ok: true, request: "234", timestamp: 234, content: buffData.toString("base64") }
            ]
            const wsServer = new DevWebSocketServer({ port, responses })

            // Client
            const gatewayInfo = wsServer.gatewayInfo
            const gw = new DVoteGateway(gatewayInfo)
            await gw.connect()

            const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)
            expect(result1).to.equal("ipfs://2345")

            expect(wsServer.interactionCount).to.equal(1)

            const result2 = await fetchFileBytes(result1, gw)
            expect(result2.toString()).to.equal(buffData.toString())

            expect(wsServer.interactionCount).to.equal(2)
            expect(wsServer.interactionList[1].requested.request.method).to.equal("fetchFile")
            expect(wsServer.interactionList[1].requested.request.uri).to.equal(result1)
            expect(wsServer.interactionList[1].requested.id).to.match(/^[0-9a-fA-F]{10}$/)

            gw.disconnect()
            await wsServer.stop()
        })

        it("Should request to unpin an old file")

        it("Should list the currently pinned files")

        it("Should enforce authenticated upload requests", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            const wsServer = new DevWebSocketServer()
            wsServer.addResponse({ ok: false, message: "Invalid wallet" })

            // Client
            let gw: IDVoteGateway
            try {
                const gatewayInfo = wsServer.gatewayInfo
                gw = new DVoteGateway(gatewayInfo)
                await gw.connect()

                await new Promise(resolve => setTimeout(resolve, 10))
                await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)
                throw new Error("Should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.equal("The data could not be uploaded: Invalid wallet")
            }
            gw.disconnect()

            expect(wsServer.interactionCount).to.equal(1)

            await wsServer.stop()
        })

        it("Should enforce authenticated unpin requests")
    })
})

describe("Web3 gateway client", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
    })

    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC provider to interact with the blockchain", async () => {
            // Web3 node
            const web3Server = new DevWeb3Service()
            await web3Server.start()

            const addr = web3Server.accounts[0].address

            const gw = new Web3Gateway(web3Server.uri)
            const gwProvider = gw.getProvider()
            const balance = await gwProvider.getBalance(addr)

            expect(balance.toHexString()).to.match(/^0x[0-9a-fA-F]{10,}$/)

            await web3Server.stop()
        })
    })

})
