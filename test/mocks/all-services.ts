import { DevWebSocketServer } from "./web-socket-service"
import { DevWeb3Service } from "./web3-service"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { Gateway } from "../../src/net/gateway"

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

    get web3Gateway() { return this.web3.gatewayClient }

    get gatewayInfo() {
        return new GatewayInfo(this.ws.uri, ["file", "vote", "census", "results"], this.web3.uri, this.ws.publicKey)
    }

    get gateway() {
        const dvoteGw = this.ws.gatewayClient
        const web3Gw = this.web3.gatewayClient

        const gateway = new Gateway(dvoteGw, web3Gw)

        // TODO: Override gateway.getEntityResolverInstance, ...

        return gateway
    }
}
