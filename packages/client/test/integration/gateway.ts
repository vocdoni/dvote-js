import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { DevGatewayService } from "../helpers/dvote-service"
import { DevWeb3Service, getWallets } from "../helpers/web3-service"
import { DVoteGateway, GatewayInfo, Web3Gateway } from "../../src"
import { BackendApiName, GatewayApiName } from "../../src/apis/definition"

let port: number = 9200

const defaultConnectResponse = { timestamp: 123, ok: true, apiList: ["file", "vote", "census", "results"], health: 100 } as { ok: boolean, apiList: (GatewayApiName | BackendApiName)[], health: number }
const defaultDummyResponse = { ok: true }

addCompletionHooks()

describe("DVote gateway client", () => {
    let dvoteServer: DevGatewayService
    beforeEach(() => {
        dvoteServer = new DevGatewayService({ port })
        return dvoteServer.start()
    })
    afterEach(() => dvoteServer.stop())

    describe("Lifecycle", () => {
        it("Should create a DVoteGateway instance", async () => {
            const gatewayInfo = dvoteServer.gatewayInfo

            expect(() => {
                new DVoteGateway({ uri: "", supportedApis: [], publicKey: "" })
            }).to.throw

            const gw2 = new DVoteGateway(gatewayInfo)
            await gw2.init()

            expect(gw2.uri).to.equal(gatewayInfo.dvote)
        })

        it("Should update the gateway's URI and point to the new location", async () => {
            const port1 = 9010
            const dvoteServer1 = new DevGatewayService({ port: port1, responses: [defaultConnectResponse, defaultDummyResponse] })
            await dvoteServer1.start()
            const gatewayUri1 = dvoteServer1.uri
            expect(dvoteServer1.interactionCount).to.equal(0)

            const gatewayInfo1 = new GatewayInfo(gatewayUri1, ["file", "vote", "census"], "https://server/path", "")
            let gwClient = new DVoteGateway(gatewayInfo1)
            expect(gwClient.uri).to.equal(gatewayInfo1.dvote)
            await gwClient.init()
            await gwClient.sendRequest({ method: "addClaim", processId: "1234", nullifier: "2345" })

            await dvoteServer1.stop()

            const port2 = 9011
            const dvoteServer2 = new DevGatewayService({ port: port2, responses: [defaultConnectResponse, defaultDummyResponse] })
            await dvoteServer2.start()
            const gatewayUri2 = dvoteServer2.uri
            const gatewayInfo2 = new GatewayInfo(gatewayUri2, ["file", "vote", "census"], "https://server/path", "")

            expect(dvoteServer2.interactionCount).to.equal(0)

            gwClient = new DVoteGateway(gatewayInfo2)
            await gwClient.init()
            expect(gwClient.uri).to.equal(gatewayInfo2.dvote)
            await gwClient.sendRequest({ method: "addClaim", processId: "5678", nullifier: "6789" })

            await dvoteServer2.stop()

            expect(dvoteServer1.interactionCount).to.equal(2)
            expect(dvoteServer2.interactionCount).to.equal(2)
        })

        it("Should allow calls to methods with the same name in different api", async () => {
            const port1 = 9010
            const dvoteServer1 = new DevGatewayService({
                port: port1,
                responses: [
                    { ...defaultConnectResponse, apiList: ['registry'] },
                    defaultDummyResponse,
                ]
            })
            await dvoteServer1.start()
            const gatewayUri1 = dvoteServer1.uri
            expect(dvoteServer1.interactionCount).to.equal(0)

            const gatewayInfo1 = new GatewayInfo(gatewayUri1, ["registry"], "https://server/path", "")
            let gwClient = new DVoteGateway(gatewayInfo1)
            expect(gwClient.uri).to.equal(gatewayInfo1.dvote)
            await gwClient.init()
            await gwClient.sendRequest({ method: "addCensus", censusId: "1234", targetId: "2345", census: { name: "test" } })

            await dvoteServer1.stop()
        })
    })

    describe("WebSocket requests", () => {
        it("Should send messages and provide responses in the right order", async () => {
            dvoteServer.addResponse({ ok: true, result: "OK 1" })
            dvoteServer.addResponse({ ok: true, result: "OK 2" })
            dvoteServer.addResponse({ ok: true, result: "OK 3" })
            dvoteServer.addResponse({ ok: true, result: "OK 4" })
            dvoteServer.addResponse({ ok: true, result: "OK 5" })
            const gatewayInfo = dvoteServer.gatewayInfo
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.init()

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
            expect(dvoteServer.interactionCount).to.equal(5 + 1)
            expect(dvoteServer.interactionList[0 + 1].requested.request.method).to.equal("addCensus")
            expect(dvoteServer.interactionList[0 + 1].requested.request.processId).to.equal("1234")
            expect(dvoteServer.interactionList[0 + 1].requested.request.nullifier).to.equal("2345")
            expect(dvoteServer.interactionList[1 + 1].requested.request.method).to.equal("addClaim")
            expect(dvoteServer.interactionList[1 + 1].requested.request.processId).to.equal("3456")
            expect(dvoteServer.interactionList[1 + 1].requested.request.nullifier).to.equal("4567")
            expect(dvoteServer.interactionList[2 + 1].requested.request.method).to.equal("addClaimBulk")
            expect(dvoteServer.interactionList[2 + 1].requested.request.processId).to.equal("5678")
            expect(dvoteServer.interactionList[2 + 1].requested.request.nullifier).to.equal("6789")
            expect(dvoteServer.interactionList[3 + 1].requested.request.method).to.equal("fetchFile")
            expect(dvoteServer.interactionList[3 + 1].requested.request.uri).to.equal("12345")
            expect(dvoteServer.interactionList[4 + 1].requested.request.method).to.equal("fetchFile")
            expect(dvoteServer.interactionList[4 + 1].requested.request.uri).to.equal("67890")
        })
        it("Should provide an encrypted channel to communicate with clients")
        it("Should report errors and throw them as an error", async () => {
            const gatewayInfo = dvoteServer.gatewayInfo
            const gwClient = new DVoteGateway(gatewayInfo)
            await gwClient.init()

            dvoteServer.addResponse({ ok: false, message: "ERROR 1" })
            dvoteServer.addResponse({ ok: false, message: "ERROR 2" })
            dvoteServer.addResponse({ ok: false, message: "ERROR 3" })
            dvoteServer.addResponse({ ok: false, message: "ERROR 4" })
            dvoteServer.addResponse({ ok: false, message: "ERROR 5" })

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

            expect(dvoteServer.interactionCount).to.equal(5 + 1)
            expect(dvoteServer.interactionList[0 + 1].requested.request.method).to.equal("addCensus")
            expect(dvoteServer.interactionList[0 + 1].requested.request.processId).to.equal("1234")
            expect(dvoteServer.interactionList[0 + 1].requested.request.nullifier).to.equal("2345")
            expect(dvoteServer.interactionList[1 + 1].requested.request.method).to.equal("addCensus")
            expect(dvoteServer.interactionList[1 + 1].requested.request.processId).to.equal("3456")
            expect(dvoteServer.interactionList[1 + 1].requested.request.nullifier).to.equal("4567")
            expect(dvoteServer.interactionList[2 + 1].requested.request.method).to.equal("addCensus")
            expect(dvoteServer.interactionList[2 + 1].requested.request.processId).to.equal("5678")
            expect(dvoteServer.interactionList[2 + 1].requested.request.nullifier).to.equal("6789")
            expect(dvoteServer.interactionList[3 + 1].requested.request.method).to.equal("fetchFile")
            expect(dvoteServer.interactionList[3 + 1].requested.request.uri).to.equal("12345")
            expect(dvoteServer.interactionList[4 + 1].requested.request.method).to.equal("fetchFile")
            expect(dvoteServer.interactionList[4 + 1].requested.request.uri).to.equal("67890")
        })
    })
})

describe("Web3 gateway client", () => {
    describe("Web3 provider", () => {
        it("Should provide a Web3 JSON RPC provider to interact with the blockchain", async () => {
            // Web3 node
            const web3Server = new DevWeb3Service()
            await web3Server.start()

            const addr = getWallets()[0].address

            const gw = new Web3Gateway(web3Server.uri, "goerli", "prod")
            const balance = await gw.provider.getBalance(addr)

            expect(balance.toHexString()).to.match(/^0x[0-9a-fA-F]{10,}$/)

            web3Server.stop()
        })
    })

})
