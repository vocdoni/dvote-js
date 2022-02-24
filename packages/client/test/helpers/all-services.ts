import { DevGatewayService, TestResponseBody } from "./dvote-service"
import { DevWeb3Service } from "./web3-service"
import { Client } from "../../src"

export { DevGatewayService, TestResponse, TestResponseBody, MockedInteraction } from "./dvote-service"
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
    get bootnodeUri() { return `http://localhost:${this.dvote.port}/gateways.json` } // DVote
    get client() {
        return new Client(this.dvote.uri, this.web3.uri)
    }

    /** Returns accounts with funds on the in-memory ganacle blockchain */
    get accounts() {
        return this.web3.accounts
    }
}
