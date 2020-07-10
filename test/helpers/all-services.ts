import { DevWebSocketServer } from "./web-socket-service"
import { DevWeb3Service } from "./web3-service"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { Gateway, Web3Gateway } from "../../src/net/gateway"

export { WSResponse, WSResponseBody, WebSocketMockedInteraction } from "./web-socket-service"
export { getAccounts, TestAccount } from "./web3-service"

export default class DevServices {
    readonly ws: DevWebSocketServer
    readonly web3: DevWeb3Service

    constructor() {
        this.ws = new DevWebSocketServer()
        this.web3 = new DevWeb3Service()
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
    get dvoteGateway() { return this.ws.gatewayClient }

    getWeb3Gateway(entityResolverAddress: string = "", namespaceAddress: string = "", processAddress: string = ""): Web3Gateway {
        return this.web3.getGatewayClient(entityResolverAddress, namespaceAddress, processAddress)
    }

    get gatewayInfo() {
        return new GatewayInfo(this.ws.uri, ["file", "vote", "census", "results"], this.web3.uri, this.ws.publicKey)
    }

    /** Returns a Gateway client for the WS and Web3 local services */
    get gateway() {
        const dvoteGw = this.ws.gatewayClient
        const web3Gw = this.web3.getGatewayClient()

        return new Gateway(dvoteGw, web3Gw)
    }

    /** Returns a Gateway client for the WS and Web3 local services. The Web3 gateway uses the given addresses as the resolved ones for the contracts */
    getGateway(entityResolverAddress: string = "", namespaceAddress: string = "", processAddress: string = ""): Gateway {
        const dvoteGw = this.ws.gatewayClient
        const web3Gw = this.web3.getGatewayClient(entityResolverAddress, namespaceAddress, processAddress)

        return new Gateway(dvoteGw, web3Gw)
    }
}
