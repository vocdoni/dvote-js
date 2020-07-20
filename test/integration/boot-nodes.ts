import "mocha" // using @types/mocha
import { expect } from "chai"
import { Network } from "../.."

import { DVoteGateway, Web3Gateway } from "../../src/net/gateway"
import {
    getGatewaysFromBootNodeData,
    fetchFromBootNode,
    fetchDefaultBootNode
} from "../../src/net/gateway-bootnodes"

const DEV_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.dev.json"
const PRODUCTION_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.json"

describe("Boot nodes", () => {

    it("fetchFromBootNode with getGatewaysFromBootNodeData should provide a gateway list", async () => {
        let bootnodeData = await fetchFromBootNode(DEV_BOOTNODES_URL)
        let bootnodes = await getGatewaysFromBootNodeData(bootnodeData)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(bootnodes["goerli"].dvote).to.have.length.gte(1)
        expect(bootnodes["goerli"].web3).to.have.length.gte(1)

        expect(bootnodes["goerli"].dvote[0] instanceof DVoteGateway).to.be.true
        expect(bootnodes["goerli"].web3[0] instanceof Web3Gateway).to.be.true

        expect(typeof bootnodes["goerli"].dvote[0].connect).to.equal("function")
        expect(typeof bootnodes["goerli"].dvote[0].disconnect).to.equal("function")
        expect(typeof bootnodes["goerli"].dvote[0].getUri).to.equal("function")
        expect(typeof await bootnodes["goerli"].dvote[0].getUri()).to.equal("string")
        expect(typeof bootnodes["goerli"].dvote[0].sendMessage).to.equal("function")
        expect(typeof bootnodes["goerli"].dvote[0].isConnected).to.equal("function")
        expect(typeof bootnodes["goerli"].dvote[0].publicKey).to.equal("string")

        expect(typeof bootnodes["goerli"].web3[0].attach).to.equal("function")
        expect(typeof bootnodes["goerli"].web3[0].deploy).to.equal("function")
        expect(typeof bootnodes["goerli"].web3[0].getProvider).to.equal("function")

        // XDAI

        bootnodeData = await fetchFromBootNode(PRODUCTION_BOOTNODES_URL)
        bootnodes = await getGatewaysFromBootNodeData(bootnodeData)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(bootnodes["xdai"].dvote).to.have.length.gte(1)
        expect(bootnodes["xdai"].web3).to.have.length.gte(1)

        expect(bootnodes["xdai"].dvote[0] instanceof DVoteGateway).to.be.true
        expect(bootnodes["xdai"].web3[0] instanceof Web3Gateway).to.be.true

        expect(typeof bootnodes["xdai"].dvote[0].connect).to.equal("function")
        expect(typeof bootnodes["xdai"].dvote[0].disconnect).to.equal("function")
        expect(typeof bootnodes["xdai"].dvote[0].getUri).to.equal("function")
        expect(typeof await bootnodes["xdai"].dvote[0].getUri()).to.equal("string")
        expect(typeof bootnodes["xdai"].dvote[0].sendMessage).to.equal("function")
        expect(typeof bootnodes["xdai"].dvote[0].isConnected).to.equal("function")
        expect(typeof bootnodes["xdai"].dvote[0].publicKey).to.equal("string")

        expect(typeof bootnodes["xdai"].web3[0].attach).to.equal("function")
        expect(typeof bootnodes["xdai"].web3[0].deploy).to.equal("function")
        expect(typeof bootnodes["xdai"].web3[0].getProvider).to.equal("function")
    }).timeout(5000)

    it("fetchDefaultBootNode (default) should provide a bootnode JSON structure", async () => {
        let bootnodes = await fetchDefaultBootNode("goerli")

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["goerli"].dvote)).to.be.true
        expect(typeof bootnodes["goerli"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["goerli"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["goerli"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["goerli"].web3[0].uri).to.equal("string")

        // XDAI
        bootnodes = await fetchDefaultBootNode("xdai")

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["xdai"].dvote)).to.be.true
        expect(typeof bootnodes["xdai"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["xdai"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["xdai"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["xdai"].web3[0].uri).to.equal("string")
    }).timeout(12000)

    it("fetchFromBootNode should provide a bootnode JSON structure", async () => {
        let bootnodes = await fetchFromBootNode(DEV_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["goerli"].dvote)).to.be.true
        expect(typeof bootnodes["goerli"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["goerli"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["goerli"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["goerli"].web3[0].uri).to.equal("string")

        // XDAI
        bootnodes = await fetchFromBootNode(PRODUCTION_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["xdai"].dvote)).to.be.true
        expect(typeof bootnodes["xdai"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["xdai"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["xdai"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["xdai"].web3[0].uri).to.equal("string")
    })

})
