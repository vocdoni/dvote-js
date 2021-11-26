import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { DevGatewayService } from "../helpers/dvote-service"
import { DevWeb3Service } from "../helpers/web3-service"

import { FileApi } from "../../src"
import { Buffer } from "buffer/"
import { DVoteGateway } from "../../src"

let baseAccount = new DevWeb3Service({ port: 80000 }).accounts[0]
let port: number = 9200

addCompletionHooks()

describe("DVote gateway client", () => {
    let dvoteServer: DevGatewayService
    beforeEach(() => {
        dvoteServer = new DevGatewayService({ port })
        return dvoteServer.start()
    })
    afterEach(() => dvoteServer.stop())

    describe("IPFS", () => {
        it("Should upload a file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // Client
            const gatewayInfo = dvoteServer.gatewayInfo
            const gw = new DVoteGateway(gatewayInfo)
            await gw.init()

            dvoteServer.addResponse({ ok: true, uri: "ipfs://1234" })

            const result1 = await FileApi.add(buffData, "my-file.txt", baseAccount.wallet, gw)

            expect(dvoteServer.interactionCount).to.equal(1 + 1)
            expect(dvoteServer.interactionList[0 + 1].requested.request.method).to.equal("addFile")
            expect(dvoteServer.interactionList[0 + 1].requested.request.type).to.equal("ipfs")
            expect(dvoteServer.interactionList[0 + 1].requested.request.content).to.equal(buffData.toString("base64"))
            expect(dvoteServer.interactionList[0 + 1].requested.id).to.match(/^[0-9a-fA-F]{10}$/)
            expect(dvoteServer.interactionList[0 + 1].requested.signature).to.match(/^0x[0-9a-fA-F]{100,}$/)

            expect(result1.length).to.be.ok
            expect(result1).to.equal("ipfs://1234")
        })

        it("Should retrieve a pinned file", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            dvoteServer.addResponse({ ok: true, uri: "ipfs://2345" })
            dvoteServer.addResponse({ ok: true, request: "234", timestamp: 234, content: buffData.toString("base64") })

            // Client
            const gatewayInfo = dvoteServer.gatewayInfo
            const gw = new DVoteGateway(gatewayInfo)
            await gw.init()

            const result1 = await FileApi.add(buffData, "my-file.txt", baseAccount.wallet, gw)
            expect(result1).to.equal("ipfs://2345")

            expect(dvoteServer.interactionCount).to.equal(1 + 1)

            const result2 = await FileApi.fetchBytes(result1, gw)
            expect(result2.toString()).to.equal(buffData.toString())

            expect(dvoteServer.interactionCount).to.equal(2 + 1)
            expect(dvoteServer.interactionList[1 + 1].requested.request.method).to.equal("fetchFile")
            expect(dvoteServer.interactionList[1 + 1].requested.request.uri).to.equal(result1)
            expect(dvoteServer.interactionList[1 + 1].requested.id).to.match(/^[0-9a-fA-F]{10}$/)
        })

        it("Should request to unpin an old file")

        it("Should list the currently pinned files")

        it("Should enforce authenticated upload requests", async () => {
            const fileContent = "HI THERE"
            const buffData = Buffer.from(fileContent)

            // DVoteGateway (server)
            dvoteServer.addResponse({ ok: false, message: "Invalid wallet" })

            // Client
            let gw: DVoteGateway
            try {
                const gatewayInfo = dvoteServer.gatewayInfo
                gw = new DVoteGateway(gatewayInfo)
                await gw.init()

                await new Promise(resolve => setTimeout(resolve, 10))
                await FileApi.add(buffData, "my-file.txt", baseAccount.wallet, gw)
                throw new Error("Should have thrown an error but didn't")
            }
            catch (err) {
                expect(err.message).to.equal("The data could not be uploaded: Invalid wallet")
            }

            expect(dvoteServer.interactionCount).to.equal(1 + 1)
        })

        it("Should enforce authenticated unpin requests")
    })
})
