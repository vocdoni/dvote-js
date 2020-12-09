import { DevGatewayService, TestResponseBody } from "./dvote-service"
import { DevWeb3Service } from "./web3-service"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { Gateway, Web3Gateway } from "../../src/net/gateway"

export { TestResponse, TestResponseBody, MockedInteraction } from "./dvote-service"
export { TestAccount } from "./web3-service"

export default class DevServices {
    readonly ws: DevGatewayService
    readonly web3: DevWeb3Service

    constructor(dvoteParams: { port?: number, responses?: TestResponseBody[] } = {}, web3Params: { port?: number, mnemonic?: string } = {}) {
        this.ws = new DevGatewayService(dvoteParams)
        this.web3 = new DevWeb3Service(web3Params)
    }

    start(): Promise<void> {
        return this.ws.start()
            .then(() => this.web3.start())
    }

    stop() {
        this.web3.stop()
        return this.ws.stop()
    }

    // GETTERS
    get dvoteGateway() { return this.ws.client }

    getWeb3Gateway(entityResolverAddress: string = "", namespaceAddress: string = "", processAddress: string = ""): Promise<Web3Gateway> {
        return this.web3.getClient(entityResolverAddress, namespaceAddress, processAddress)
    }

    get gatewayInfo() {
        return new GatewayInfo(this.ws.uri, ["file", "vote", "census", "results", "info"], this.web3.uri, this.ws.publicKey)
    }

    /** Returns a Gateway client for the WS and Web3 local services */
    get gateway() {
        const dvoteGw = this.ws.client
        return this.web3.getClient()
            .then(web3Gw => new Gateway(dvoteGw, web3Gw))
    }

    /** Returns a Gateway client for the WS and Web3 local services. The Web3 gateway uses the given addresses as the resolved ones for the contracts */
    getGateway(entityResolverAddress: string = "", namespaceAddress: string = "", processAddress: string = ""): Promise<Gateway> {
        const dvoteGw = this.ws.client

        return this.web3.getClient(entityResolverAddress, namespaceAddress, processAddress)
            .then(web3Gw => new Gateway(dvoteGw, web3Gw))
    }

    /** Returns accounts with funds on the in-memory ganacle blockchain */
    get accounts() {
        return this.web3.accounts
    }
}
