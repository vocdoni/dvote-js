import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, TestAccount } from "../testing-eth-utils"
import { DVoteGateway, Web3Gateway } from "../../src/net/gateway"
import { addFile, fetchFileBytes } from "../../src/api/file"
import { GatewayMock, InteractionMock, GatewayResponse } from "../mocks/gateway"
import { server as ganacheRpcServer } from "ganache-core"
import { Buffer } from "buffer"
import GatewayInfo from "../../src/util/gateway-info";

const port = 8500
const gatewayUri = `ws://localhost:${port}`
const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount

const defaultDummyResponse = { id: "123", response: { request: "123", timestamp: 123, ok: true }, signature: "123" }

addCompletionHooks()

describe("DVoteGateway", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
    })

    describe("Lifecycle", () => {
        it("Should create a DVoteGateway instance", async () => {
            const gatewayServer = new GatewayMock({ port, responses: [] })

            expect(() => {
                const gw1 = new DVoteGateway({ uri: "", supportedApis: [], publicKey: "" })
            }).to.throw

            const gw2 = new DVoteGateway(gatewayInfo)
            await gw2.connect()

            expect(await gw2.getUri()).to.equal(gatewayInfo.dvote)

            gw2.disconnect()
            await gatewayServer.stop()
        })

        it("Should update the gateway's URI and point to the new location", async () => {
            const port1 = port + 1
            const gatewayUri1 = `ws://127.0.0.1:${port1}`
            const gatewayServer1 = new GatewayMock({ port: port1, responses: [defaultDummyResponse] })
            expect(gatewayServer1.interactionCount).to.equal(0)

            const gatewayInfo1 = new GatewayInfo(gatewayUri1, ["file", "vote", "census"], "https://server/path", "")
            const gwClient = new DVoteGateway(gatewayInfo1)
            expect(await gwClient.getUri()).to.equal(gatewayInfo1.dvote)
            await gwClient.connect()
            await gwClient.sendMessage({ method: "addClaim", processId: "1234", nullifier: "2345" })

            await gwClient.disconnect()
            await gatewayServer1.stop()

            const port2 = 9000
            const gatewayUri2 = `ws://127.0.0.1:${port2}`
            const gatewayInfo2 = new GatewayInfo(gatewayUri2, ["file", "vote", "census"], "https://server/path", "")

            const gatewayServer2 = new GatewayMock({ port: port2, responses: [defaultDummyResponse] })
            expect(gatewayServer2.interactionCount).to.equal(0)

            await gwClient.connect(gatewayInfo2)
            expect(await gwClient.getUri()).to.equal(gatewayInfo2.dvote)
            await gwClient.sendMessage({ method: "addClaim", processId: "5678", nullifier: "6789" })

            await gwClient.disconnect()
            await gatewayServer2.stop()

            expect(gatewayServer1.interactionCount).to.equal(1)
            expect(gatewayServer2.interactionCount).to.equal(1)
        })
    })

    describe("WebSocket requests", () => {
        it("Should send messages and provide responses in the right order", async () => {
            const gatewayServer = new GatewayMock({
                port,
                responses: [
                    { id: "123", response: { request: "123", timestamp: 123, result: "OK 1" }, signature: "123" },
                    { id: "234", response: { request: "234", timestamp: 234, result: "OK 2" }, signature: "234" },
                    { id: "345", response: { request: "345", timestamp: 345, result: "OK 3" }, signature: "345" },
                    { id: "345", response: { request: "345", timestamp: 345, result: "OK 4" }, signature: "345" },
                    { id: "456", response: { request: "456", timestamp: 456, result: "OK 5" }, signature: "456" },
                ]
            })
            const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.connect()

            const response1 = await gwClient.sendMessage({ method: "addCensus", processId: "1234", nullifier: "2345" })
            const response2 = await gwClient.sendMessage({ method: "addClaim", processId: "3456", nullifier: "4567" })
            const response3 = await gwClient.sendMessage({ method: "addClaimBulk", processId: "5678", nullifier: "6789" })
            const response4 = await gwClient.sendMessage({ method: "fetchFile", uri: "12345" })
            const response5 = await gwClient.sendMessage({ method: "fetchFile", uri: "67890" })

            expect(response1.result).to.equal("OK 1")
            expect(response2.result).to.equal("OK 2")
            expect(response3.result).to.equal("OK 3")
            expect(response4.result).to.equal("OK 4")
            expect(response5.result).to.equal("OK 5")
            expect(gatewayServer.interactionCount).to.equal(5)
            expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addCensus")
            expect(gatewayServer.interactionList[0].actual.request.processId).to.equal("1234")
            expect(gatewayServer.interactionList[0].actual.request.nullifier).to.equal("2345")
            expect(gatewayServer.interactionList[1].actual.request.method).to.equal("addClaim")
            expect(gatewayServer.interactionList[1].actual.request.processId).to.equal("3456")
            expect(gatewayServer.interactionList[1].actual.request.nullifier).to.equal("4567")
            expect(gatewayServer.interactionList[2].actual.request.method).to.equal("addClaimBulk")
            expect(gatewayServer.interactionList[2].actual.request.processId).to.equal("5678")
            expect(gatewayServer.interactionList[2].actual.request.nullifier).to.equal("6789")
            expect(gatewayServer.interactionList[3].actual.request.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[3].actual.request.uri).to.equal("12345")
            expect(gatewayServer.interactionList[4].actual.request.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[4].actual.request.uri).to.equal("67890")

            await gatewayServer.stop()
        })
        it("Should provide an encrypted channel to communicate with clients")
        it("Should report errors and throw them as an error", async () => {
            const gatewayServer = new GatewayMock({
                port,
                responses: [
                    { id: "123", error: { request: "123", timestamp: 123, message: "ERROR 1" }, signature: "123" },
                    { id: "234", error: { request: "234", timestamp: 234, message: "ERROR 2" }, signature: "234" },
                    { id: "345", error: { request: "345", timestamp: 345, message: "ERROR 3" }, signature: "345" },
                    { id: "345", error: { request: "345", timestamp: 345, message: "ERROR 4" }, signature: "345" },
                    { id: "456", error: { request: "456", timestamp: 456, message: "ERROR 5" }, signature: "456" },
                ]
            })
            const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.connect()

            try {
                await gwClient.sendMessage({ method: "addCensus", processId: "1234", nullifier: "2345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 1")
            }
            try {
                await gwClient.sendMessage({ method: "addCensus", processId: "3456", nullifier: "4567" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 2")
            }
            try {
                await gwClient.sendMessage({ method: "addCensus", processId: "5678", nullifier: "6789" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 3")
            }
            try {
                await gwClient.sendMessage({ method: "fetchFile", uri: "12345" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 4")
            }
            try {
                await gwClient.sendMessage({ method: "fetchFile", uri: "67890" })
                throw new Error("Request did not fail")
            }
            catch (err) {
                expect(err.message).to.equal("ERROR 5")
            }

            expect(gatewayServer.interactionCount).to.equal(5)
            expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addCensus")
            expect(gatewayServer.interactionList[0].actual.request.processId).to.equal("1234")
            expect(gatewayServer.interactionList[0].actual.request.nullifier).to.equal("2345")
            expect(gatewayServer.interactionList[1].actual.request.method).to.equal("addCensus")
            expect(gatewayServer.interactionList[1].actual.request.processId).to.equal("3456")
            expect(gatewayServer.interactionList[1].actual.request.nullifier).to.equal("4567")
            expect(gatewayServer.interactionList[2].actual.request.method).to.equal("addCensus")
            expect(gatewayServer.interactionList[2].actual.request.processId).to.equal("5678")
            expect(gatewayServer.interactionList[2].actual.request.nullifier).to.equal("6789")
            expect(gatewayServer.interactionList[3].actual.request.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[3].actual.request.uri).to.equal("12345")
            expect(gatewayServer.interactionList[4].actual.request.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[4].actual.request.uri).to.equal("67890")

            await gatewayServer.stop()
        })
    })

    // describe("Swarm", () => {
    //     it("Should upload a file", async () => {
    //         const fileContent = "GOOD MORNING"
    //         const buffData = Buffer.from(fileContent)

    //         // DVoteGateway (server)
    //         const responses: GatewayResponse[] = [{ error: false, response: ["bzz://1234"] }]
    //         const gatewayServer = new GatewayMock({ port, responses })

    //         // Client
    //         const gw = new DVoteGateway(gatewayUri)
    //         const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)

    //         expect(gatewayServer.interactionCount).to.equal(1)
    //         expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addFile")
    //         expect(gatewayServer.interactionList[0].actual.request.type).to.equal("swarm")
    //         expect(gatewayServer.interactionList[0].actual.request.content).to.equal(buffData)
    //         expect(gatewayServer.interactionList[0].actual.request.address).to.equal(baseAccount.address)
    //         expect(gatewayServer.interactionList[0].actual.id).to.match(/^0x[0-9a-fA-F]{64}$/)
    //         expect(gatewayServer.interactionList[0].actual.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

    //         expect(result1.length).to.be.ok
    //         expect(result1).to.equal("bzz://1234")

    //         await gatewayServer.stop()
    //     })
    //     it("Should retrieve a pinned file", async () => {
    //         const fileContent = "HELLO WORLD"
    //         const buffData = Buffer.from(fileContent)

    //         // DVoteGateway (server)
    //         const responses: GatewayResponse[] = [
    //             { error: false, response: ["bzz://2345"] },
    //             { error: false, response: [buffData.toString("base64")] }
    //         ]
    //         const gatewayServer = new GatewayMock({ port, responses })

    //         // Client
    //         const gw = new DVoteGateway(gatewayUri)
    //         const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)
    //         expect(result1).to.equal("bzz://2345")

    //         expect(gatewayServer.interactionCount).to.equal(1)

    //         const result2 = (await fetchFileBytes(result1, gw)).toString("base64")
    //         expect(result2).to.equal(buffData)

    //         expect(gatewayServer.interactionCount).to.equal(2)
    //         expect(gatewayServer.interactionList[1].actual.request.method).to.equal("fetchFile")
    //         expect(gatewayServer.interactionList[1].actual.request.uri).to.equal(result1)
    //         expect(gatewayServer.interactionList[1].actual.id).to.match(/^0x[0-9a-fA-F]{64}$/)

    //         await gatewayServer.stop()
    //     })
    //     it("Should request to unpin an old file")
    //     it("Should list the currently pinned files")
    //     it("Should enforce authenticated upload requests", async () => {
    //         const fileContent = "HI THERE"
    //         const buffData = Buffer.from(fileContent)

    //         // DVoteGateway (server)
    //         const gatewayServer = new GatewayMock({ port, responses: [] })

    //         // Client
    //         try {
    //             const gw = new DVoteGateway(gatewayUri)
    //             await new Promise(resolve => setTimeout(resolve, 10))
    //             await addFile(buffData, "my-file.txt", null, gw)
    //             throw new Error("Should have thrown an error but didn't")
    //         }
    //         catch (err) {
    //             expect(err.message).to.equal("Invalid wallet")
    //         }

    //         expect(gatewayServer.interactionCount).to.equal(0)

    //         await gatewayServer.stop()
    //     })
    //     it("Should enforce authenticated unpin requests")
    // })

    describe("IPFS", () => {
        it("Should upload a file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            const responses: GatewayResponse[] = [
                { id: "123", response: { request: "123", timestamp: 123, uri: "ipfs://ipfs/1234" }, signature: "123" }
            ]
            const gatewayServer = new GatewayMock({ port, responses })

            // Client
            const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
            const gw = new DVoteGateway(gatewayInfo)
            await gw.connect()
            const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)

            expect(gatewayServer.interactionCount).to.equal(1)
            expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addFile")
            expect(gatewayServer.interactionList[0].actual.request.type).to.equal("ipfs")
            expect(gatewayServer.interactionList[0].actual.request.content).to.equal(buffData.toString("base64"))
            expect(gatewayServer.interactionList[0].actual.id).to.match(/^[0-9a-fA-F]{64}$/)
            expect(gatewayServer.interactionList[0].actual.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

            expect(result1.length).to.be.ok
            expect(result1).to.equal("ipfs://ipfs/1234")

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("Should retrieve a pinned file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            const responses: GatewayResponse[] = [
                { id: "123", response: { request: "123", timestamp: 123, uri: "ipfs://ipfs/2345" }, signature: "123" },
                { id: "234", response: { request: "234", timestamp: 234, content: buffData.toString("base64") }, signature: "234" }
            ]
            const gatewayServer = new GatewayMock({ port, responses })

            // Client
            const gatewayInfo = new GatewayInfo(gatewayUri, ["file"], "https://server/path", "")
            const gw = new DVoteGateway(gatewayInfo)
            await gw.connect()
            
            const result1 = await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)
            expect(result1).to.equal("ipfs://ipfs/2345")

            expect(gatewayServer.interactionCount).to.equal(1)

            const result2 = await fetchFileBytes(result1, gw)
            expect(result2.toString()).to.equal(buffData.toString())

            expect(gatewayServer.interactionCount).to.equal(2)
            expect(gatewayServer.interactionList[1].actual.request.method).to.equal("fetchFile")
            expect(gatewayServer.interactionList[1].actual.request.uri).to.equal(result1)
            expect(gatewayServer.interactionList[1].actual.id).to.match(/^[0-9a-fA-F]{64}$/)

            gw.disconnect()
            await gatewayServer.stop()
        })
        it("Should request to unpin an old file")
        it("Should list the currently pinned files")
        it("Should enforce authenticated upload requests", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)
            
            // DVoteGateway (server)
            const gatewayServer = new GatewayMock({
                port, responses: [
                    { id: "123", error: { request: "123", timestamp: 123, message: "Invalid wallet" }, signature: "123" },
                ]
            })
            
            // Client
            let gw: DVoteGateway
            try {
                const gatewayInfo = new GatewayInfo(gatewayUri, ["file"], "https://server/path", "")
                gw = new DVoteGateway(gatewayInfo)
                await gw.connect()
                
                await new Promise(resolve => setTimeout(resolve, 10))
                await addFile(buffData, "my-file.txt", baseAccount.wallet, gw)
                throw new Error("Should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.equal("Invalid wallet")
            }
            gw.disconnect()

            expect(gatewayServer.interactionCount).to.equal(1)

            await gatewayServer.stop()
        })
        it("Should enforce authenticated unpin requests")
    })

    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC provider to interact with the blockchain", async () => {
            // Web socket server
            // const webSocketServer = new GatewayMock({ port, responses: [] })

            // Web3 node
            const rpcServer = ganacheRpcServer()
            const info: any = await new Promise(resolve => rpcServer.listen(port, (err, info) => resolve(info)))

            expect(Object.keys(info.personal_accounts).length).to.be.approximately(10, 9)
            expect(Object.keys(info.personal_accounts)[0]).to.match(/^0x[0-9a-fA-F]{40}$/)

            const addr = Object.keys(info.personal_accounts)[0]

            const gatewayUri = `http://localhost:${port}`
            const gw = new Web3Gateway(gatewayUri)
            const gwProvider = gw.getProvider()
            const balance = await gwProvider.getBalance(addr)

            expect(balance.toHexString()).to.match(/^0x[0-9a-fA-F]{10,}$/)

            // webSocketServer.stop()
            rpcServer.close()
        })
    })

})
