import { DevWebSocketServer, WSResponse } from "./web-socket-service"
import { DevWeb3Service } from "./web3-service"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { Gateway } from "../../src/net/gateway"

export default class DevServices {
    readonly ws: DevWebSocketServer
    readonly w3: DevWeb3Service

    constructor() {
        const responses: WSResponse[] = []
        this.ws = new DevWebSocketServer({ responses })
        this.w3 = new DevWeb3Service()
    }

    start(): Promise<void> {
        return this.ws.start()
            .then(() => this.w3.start())
    }

    stop() {
        this.w3.stop()
        return this.ws.stop()
    }

    // GETTERS
    get dvoteGateway() { return this.ws.gatewayClient }

    get web3Gateway() { return this.w3.gatewayClient }

    get gatewayInfo() {
        return new GatewayInfo(this.ws.uri, ["file", "vote", "census", "results"], this.w3.uri, this.ws.publicKey)
    }

    get gateway() {
        const dvoteGw = this.ws.gatewayClient
        const web3Gw = this.w3.gatewayClient
        return new Gateway(dvoteGw, web3Gw)
    }
}
