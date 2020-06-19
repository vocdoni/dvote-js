import "mocha" // using @types/mocha
import { expect } from "chai"
import { Network } from "../.."


const {
    discoverGateways
} = Network.Discovery

const DEFAULT_BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.dev.json"

describe("Discovery", () => {

    it("should be implemented")

    // it("getRandomGatewayInfo should provide a gateway for each network ID", async () => {
    //     const gw = await getRandomGatewayInfo("goerli")

    //     expect(gw["non-existing-network-id"]).to.be.undefined
    //     expect(gw["goerli"]).to.be.ok
    //     expect(typeof gw["goerli"].dvote).to.equal("string")
    //     expect(typeof gw["goerli"].publicKey).to.equal("string")
    //     expect(Array.isArray(gw["goerli"].supportedApis)).to.be.true
    //     expect(typeof gw["goerli"].web3).to.equal("string")

    //     const gw2 = await getRandomGatewayInfo("goerli", DEFAULT_BOOTNODES_URL)

    //     expect(gw2["non-existing-network-id"]).to.be.undefined
    //     expect(gw2["goerli"]).to.be.ok
    //     expect(typeof gw2["goerli"].dvote).to.equal("string")
    //     expect(typeof gw2["goerli"].publicKey).to.equal("string")
    //     expect(Array.isArray(gw2["goerli"].supportedApis)).to.be.true
    //     expect(typeof gw2["goerli"].web3).to.equal("string")
    // }).timeout(12000)


})
