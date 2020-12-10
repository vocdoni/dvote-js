import { DevGatewayService, TestResponseBody } from "./dvote-service"
import { DevWeb3Service } from "./web3-service"
import { GatewayInfo } from "../../src/wrappers/gateway-info"
import { Gateway } from "../../src/net/gateway"
import { Web3Gateway } from "../../src/net/gateway-web3"

export { TestResponse, TestResponseBody, MockedInteraction } from "./dvote-service"
export { TestAccount } from "./web3-service"

export default class DevServices {
    readonly dvote: DevGatewayService
    readonly web3: DevWeb3Service

    constructor(dvoteParams: { port?: number, responses?: TestResponseBody[] } = {}, web3Params: { port?: number, mnemonic?: string } = {}) {
        this.dvote = new DevGatewayService(dvoteParams)
        this.web3 = new DevWeb3Service(web3Params)
    }

    start(): Promise<void> {
        return this.dvote.start()
            .then(() => this.web3.start())
    }

    stop(): Promise<void> {
        this.web3.stop()
        return this.dvote.stop()
    }

    // GETTERS
    get dvoteGateway() { return this.dvote.client }

    getWeb3Gateway(entityResolverAddress: string = "", namespaceAddress: string = "", storageProofAddress: string = "", processAddress: string = ""): Promise<Web3Gateway> {
        return this.web3.getClient(entityResolverAddress, namespaceAddress, storageProofAddress, processAddress)
    }

    get gatewayInfo() {
        return new GatewayInfo(this.dvote.uri, ["file", "vote", "census", "results", "info"], this.web3.uri, this.dvote.publicKey)
    }

    /** Returns a Gateway client for the dvote and Web3 local services. The Web3 gateway uses the given addresses as the resolved ones for the contracts */
    getGateway(entityResolverAddress: string = "", namespaceAddress: string = "", storageProofAddress: string = "", processAddress: string = ""): Promise<Gateway> {
        const dvoteGw = this.dvote.client

        return this.web3.getClient(entityResolverAddress, namespaceAddress, storageProofAddress, processAddress)
            .then(web3Gw => new Gateway(dvoteGw, web3Gw))
    }

    /** Returns accounts with funds on the in-memory ganacle blockchain */
    get accounts() {
        return this.web3.accounts
    }
}
