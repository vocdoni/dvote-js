import * as WebSocket from "isomorphic-ws"

type ConstructorParams = {
    port: number,
    responses: GatewayResponse[]
}
export type GatewayResponse = {
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
export type InteractionMock = {
    actual?: any,                     // What the client actually sent
    responseData: GatewayResponse    // What to send as a response
}

// THE GATEWAY SERVER MOCK

export class GatewayMock {
    private socketServer: WebSocket.Server = null
    private activeSocket: any = null
    public interactionList: InteractionMock[] = []
    public interactionCount: number = 0

    constructor(params: ConstructorParams) {
        this.socketServer = new WebSocket.Server({ port: params.port || 8000 })
        this.interactionList = params.responses.map(response => ({
            actual: null,             // no requests received yet
            responseData: response
        }))

        this.socketServer.on('connection', socket => {
            this.activeSocket = socket
            this.activeSocket.on('message', data => this.gotRequest(data))
        })
    }

    private gotRequest(requestData: string) {
        const idx = this.interactionCount
        if (idx >= this.interactionList.length) throw new Error("The Gateway received more transactions than it should: " + (this.interactionCount + 1))
        else if (!this.interactionList[idx]) throw new Error("Mock transaction data is empty")

        this.interactionList[idx].actual = JSON.parse(requestData)

        if (!this.activeSocket) throw new Error("No socket client to reply to")

        const responseData: GatewayResponse = this.interactionList[idx].responseData
        responseData.id = this.interactionList[idx].actual.id

        if (responseData.response || !responseData.response.ok) {
            responseData.response.request = this.interactionList[idx].actual.id
        }
        else {
            console.error("GATEWAY MOCK: No request or error field present", responseData)
        }

        // Reply stringified
        this.activeSocket.send(JSON.stringify(responseData))

        this.interactionCount++
    }

    public addResponse(res: GatewayResponse) {
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
}
