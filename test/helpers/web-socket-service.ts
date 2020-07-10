import * as WebSocket from "isomorphic-ws"
import { Wallet } from "ethers"
import { signJsonBody } from "../../src/util/json-sign"
import { DVoteGateway } from "../../src/net/gateway"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { getAccounts } from "./web3-service"

export type WSResponse = {
    id: string,
    response: WSResponseBody,
    signature: string
}
export type WSResponseBody = {
    ok: boolean
    message?: string
    timestamp?: number
    [key: string]: any
}
export type WebSocketMockedInteraction = {
    requested?: any,                 // What the client actually sent
    responseData: WSResponseBody     // What to send as a response
}

const defaultPort = 8500
const defaultConnectResponse: WSResponseBody = { ok: true, apiList: ["file", "vote", "census", "results"], health: 100 }

// THE GATEWAY SERVER MOCK

/**
 * Starts a web socket server that mimicks the bevahour of a DVote Gateway.
 * It allows to predefine the responses to send and it signs the messages sent back.
 */
export class DevWebSocketServer {
    private port: number
    private socketServer: WebSocket.Server = null
    private activeSocket: WebSocket = null
    public interactionList: WebSocketMockedInteraction[] = []
    public interactionCount: number = 0
    public readonly wallet: Wallet

    constructor(params: { port?: number, responses?: WSResponseBody[] } = {}) {
        if (params.responses && params.responses.some(res => typeof res != "object")) throw new Error("Invalid response provided")

        this.port = params.port || defaultPort
        this.interactionList = (params.responses || [defaultConnectResponse]).map(response => ({
            requested: null,             // no requests received yet
            responseData: response
        }))

        // Choose a pseudorandom wallet from the end of the ones available [5..9]
        const accounts = getAccounts().slice(5)
        const idx = Number(Math.random().toString().substr(2)) % accounts.length
        this.wallet = accounts[idx].wallet
    }

    public start(): Promise<void> {
        this.socketServer = new WebSocket.Server({ port: this.port })

        return new Promise((resolve) => {
            this.socketServer.on('connection', socket => {
                this.activeSocket = socket
                this.activeSocket.on('message', data => this.handleRequest(data as string))

                resolve()
            })
        })
    }

    private async handleRequest(requestData: string) {
        const idx = this.interactionCount
        if (idx >= this.interactionList.length) throw new Error("The Gateway received more transactions than it should: " + (this.interactionCount + 1))
        else if (!this.interactionList[idx]) throw new Error("Mock transaction data is empty")

        this.interactionList[idx].requested = JSON.parse(requestData)

        if (!this.activeSocket) throw new Error("No socket client to reply to")

        const response: WSResponseBody = this.interactionList[idx].responseData
        response.request = this.interactionList[idx].requested.id
        response.timestamp = Math.floor(Date.now() / 1000)

        const responseData: WSResponse = {
            id: this.interactionList[idx].requested.id,
            response,
            signature: ""
        }
        responseData.signature = await signJsonBody(responseData.response, this.wallet)

        responseData.response.request = this.interactionList[idx].requested.id

        // Reply stringified
        this.activeSocket.send(JSON.stringify(responseData))

        this.interactionCount++
    }

    public addResponse(res: WSResponseBody) {
        if (typeof res != "object") throw new Error("Invalid response provided")

        this.interactionList.push({
            requested: null,      // no request received yet
            responseData: res
        })
    }

    public stop(): Promise<void> {
        if (!this.socketServer) throw new Error("Socket server not started")

        return new Promise((resolve, reject) => {
            this.socketServer.close(err => {
                if (err) reject(err)
                else resolve()
            })
        })
    }

    // GETTERS
    get uri() { return `ws://localhost:${this.port}` }
    get privateKey() { return this.wallet["signingKey"].privateKey }
    get publicKey() { return this.wallet["signingKey"].compressedPublicKey }
    get gatewayClient() {
        return new DVoteGateway({ uri: this.uri, supportedApis: ["file", "census", "vote", "results"], publicKey: this.publicKey })
    }
    get gatewayInfo() {
        return new GatewayInfo(this.uri, ["file", "vote", "census", "results"], "http://dummy", this.publicKey)
    }
}
