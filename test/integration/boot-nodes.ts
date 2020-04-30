import "mocha" // using @types/mocha
import { expect } from "chai"
import { Network } from "../.."

const {
    DVoteGateway,
    Web3Gateway
} = Network.Gateways

const {
    getGatewaysFromBootNodeData,
    fetchFromBootNode,
    fetchDefaultBootNode
} = Network.Bootnodes

const DEFAULT_BOOTNODES_URL = "https://bootnodes.github.io/gateways.dev.json"

describe("Boot nodes", () => {

    it("fetchFromBootNode with getGatewaysFromBootNodeData should provide a gateway list", async () => {
        const bootnodeData = await fetchFromBootNode(DEFAULT_BOOTNODES_URL)
        const bootnodes = await getGatewaysFromBootNodeData(bootnodeData)

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
    }).timeout(3000)

    it("fetchDefaultBootNode (default) should provide a bootnode JSON structure", async () => {
        const bootnodes = await fetchDefaultBootNode("goerli")

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["goerli"].dvote)).to.be.true
        expect(typeof bootnodes["goerli"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["goerli"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["goerli"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["goerli"].web3[0].uri).to.equal("string")
    }).timeout(12000)

    it("fetchFromBootNode should provide a bootnode JSON structure", async () => {
        const bootnodes = await fetchFromBootNode(DEFAULT_BOOTNODES_URL)

        for (let networkId in bootnodes) {
            expect(typeof networkId).to.equal("string")
        }

        expect(Array.isArray(bootnodes["goerli"].dvote)).to.be.true
        expect(typeof bootnodes["goerli"].dvote[0].uri).to.equal("string")
        expect(typeof bootnodes["goerli"].dvote[0].pubKey).to.equal("string")
        expect(Array.isArray(bootnodes["goerli"].dvote[0].apis)).to.be.true

        expect(typeof bootnodes["goerli"].web3[0].uri).to.equal("string")
    })

})
