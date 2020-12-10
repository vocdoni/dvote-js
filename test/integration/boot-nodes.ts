import "mocha" // using @types/mocha
import { expect } from "chai"

import { DVoteGateway } from "../../src/net/gateway-dvote"
import { Web3Gateway } from "../../src/net/gateway-web3"
import { EthNetworkID, GatewayBootnode } from "../../src/net/gateway-bootnode"

const DEV_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.dev.json"
const STAGE_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.stg.json"
const PRODUCTION_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.json"

describe("Boot nodes", () => {

    it("getGatewaysFromUri with digest should provide a gateway list", async () => {
        let bootnodeData = await GatewayBootnode.getGatewaysFromUri(DEV_BOOTNODES_URL)
        let bootnodes = await GatewayBootnode.digest(bootnodeData)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")

            expect(bootnodes[networkId].dvote).to.have.length.gte(1)
            expect(bootnodes[networkId].web3).to.have.length.gte(1)

            expect(bootnodes[networkId].dvote[0] instanceof DVoteGateway).to.be.true
            expect(bootnodes[networkId].web3[0] instanceof Web3Gateway).to.be.true

            expect(typeof bootnodes[networkId].dvote[0].uri).to.equal("string")
            expect(typeof bootnodes[networkId].dvote[0].sendRequest).to.equal("function")
            expect(typeof bootnodes[networkId].dvote[0].isReady).to.equal("boolean")
            expect(typeof bootnodes[networkId].dvote[0].publicKey).to.equal("string")

            expect(typeof bootnodes[networkId].web3[0].attach).to.equal("function")
            expect(typeof bootnodes[networkId].web3[0].deploy).to.equal("function")
            expect(typeof bootnodes[networkId].web3[0].provider).to.equal("object")
        }
        // XDAI

        bootnodeData = await GatewayBootnode.getGatewaysFromUri(PRODUCTION_BOOTNODES_URL)
        bootnodes = GatewayBootnode.digest(bootnodeData)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        const NETWORK_ID = "xdai"
        expect(bootnodes[NETWORK_ID].dvote).to.have.length.gte(1)
        expect(bootnodes[NETWORK_ID].web3).to.have.length.gte(1)

        expect(bootnodes[NETWORK_ID].dvote[0] instanceof DVoteGateway).to.be.true
        expect(bootnodes[NETWORK_ID].web3[0] instanceof Web3Gateway).to.be.true

        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].sendRequest).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].isReady).to.equal("boolean")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].publicKey).to.equal("string")

        expect(typeof bootnodes[NETWORK_ID].web3[0].attach).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].web3[0].deploy).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].web3[0].provider).to.equal("object")

        // XDAI Stage

        bootnodeData = await GatewayBootnode.getGatewaysFromUri(STAGE_BOOTNODES_URL)
        const options = { testing: true }
        bootnodes = await GatewayBootnode.digest(bootnodeData, options)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(bootnodes[NETWORK_ID].dvote).to.have.length.gte(1)
        expect(bootnodes[NETWORK_ID].web3).to.have.length.gte(1)

        expect(bootnodes[NETWORK_ID].dvote[0] instanceof DVoteGateway).to.be.true
        expect(bootnodes[NETWORK_ID].web3[0] instanceof Web3Gateway).to.be.true

        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].sendRequest).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].isReady).to.equal("boolean")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].publicKey).to.equal("string")

        expect(typeof bootnodes[NETWORK_ID].web3[0].attach).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].web3[0].deploy).to.equal("function")
        expect(typeof bootnodes[NETWORK_ID].web3[0].provider).to.equal("object")
    }).timeout(20000)

    it("getDefaultGateways (default) should provide a bootnode JSON structure", async () => {
        let NETWORK_ID: EthNetworkID = "xdai"
        let bootnodes = await GatewayBootnode.getDefaultGateways(NETWORK_ID)
        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")

        // XDAI Stage
        const options = { testing: true }
        bootnodes = await GatewayBootnode.getDefaultGateways(NETWORK_ID, options)
        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")

        // XDAI
        bootnodes = await GatewayBootnode.getDefaultGateways(NETWORK_ID)
        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")

        // SOKOL
        NETWORK_ID = "sokol"
        bootnodes = await GatewayBootnode.getDefaultGateways(NETWORK_ID)
        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")
    }).timeout(20000)

    it("getGatewaysFromUri should provide a bootnode JSON structure", async () => {
        const NETWORK_ID = "xdai"
        let bootnodes = await GatewayBootnode.getGatewaysFromUri(DEV_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")

            expect(Array.isArray(bootnodes[networkId].dvote)).to.be.true
            expect(typeof bootnodes[networkId].dvote[0].uri).to.equal("string")
            expect(typeof bootnodes[networkId].dvote[0].pubKey).to.equal("string")
            expect(Array.isArray(bootnodes[networkId].dvote[0].apis)).to.be.true

            expect(typeof bootnodes[networkId].web3[0].uri).to.equal("string")
        }

        // XDAI
        bootnodes = await GatewayBootnode.getGatewaysFromUri(PRODUCTION_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")

        // XDAI Stage
        bootnodes = await GatewayBootnode.getGatewaysFromUri(STAGE_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes[NETWORK_ID].dvote)).to.be.true
        expect(typeof bootnodes[NETWORK_ID].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes[NETWORK_ID].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes[NETWORK_ID].dvote[0].apis)).to.be.true

        expect(typeof bootnodes[NETWORK_ID].web3[0].uri).to.equal("string")
    }).timeout(20000)

})
