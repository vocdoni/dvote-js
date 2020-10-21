import * as WebSocket from "isomorphic-ws"
import { Wallet } from "ethers"
import { signJsonBody } from "../../src/util/json-sign"
import { DVoteGateway } from "../../src/net/gateway"

export type WSResponse = {
    id: string
    response: {
        ok: boolean
        request: string  // Request ID here as well
        message?: string
        timestamp?: number
        [key: string]: any
    }
    signature?: string
}
export type WebSocketMockedInteraction = {
    actual?: any,                     // What the client actually sent
    responseData: WSResponse     // What to send as a response
}

const defaultPort = 8500
const defaultMnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"
const defaultConnectResponse: WSResponse = { id: "dummy", response: { request: "dummy", timestamp: 123, ok: true, apiList: ["file", "vote", "census", "results"], health: 100 }, signature: "" }

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

    constructor(params: { port?: number, responses?: WSResponse[] } = {}) {
        this.port = params.port || defaultPort
        this.interactionList = (params.responses || [defaultConnectResponse]).map(response => ({
            actual: null,             // no requests received yet
            responseData: response
        }))

        // Choose a pseudorandom wallet (lighter than generating random each time)
        const idx = Number(Math.random().toString().substr(2)) % 10
        this.wallet = Wallet.fromMnemonic(defaultMnemonic, `m/44'/60'/0'/0/${idx}`)
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

        this.interactionList[idx].actual = JSON.parse(requestData)

        if (!this.activeSocket) throw new Error("No socket client to reply to")

        const responseData: WSResponse = this.interactionList[idx].responseData
        responseData.id = this.interactionList[idx].actual.id
        responseData.signature = await signJsonBody(responseData.response, this.wallet)

        if (!responseData.response) {
            console.error("GATEWAY MOCK: No request field present", responseData)
            throw new Error("Invalid mock response set")
        }

        responseData.response.request = this.interactionList[idx].actual.id

        // Reply stringified
        this.activeSocket.send(JSON.stringify(responseData))

        this.interactionCount++
    }

    public addResponse(res: WSResponse) {
        this.interactionList.push({
            actual: null,      // no request received yet
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
}
