import * as WebSocket from "ws"

type ConstructorParams = {
    port: number,
    responseList: GatewayResponse[]
}
export type GatewayResponse = {
    error: boolean,
    response: string[],
    requestId?: string
}
export type InteractionMock = {
    actual?: any,                     // What the client actually sent
    responseData: GatewayResponse     // What to send as a response
}

// THE GATEWAY SERVER MOCK

export class GatewayMock {
    private socketServer: WebSocket.Server = null
    private activeSocket: any = null
    public interactionList: InteractionMock[] = []
    public interactionCount: number = 0

    constructor(params: ConstructorParams) {
        this.socketServer = new WebSocket.Server({ port: params.port || 8000 })
        this.interactionList = params.responseList.map(response => {
            return {
                actual: null,             // no requests received yet
                responseData: response
            }
        })

        this.socketServer.on('connection', socket => {
            this.activeSocket = socket
            this.activeSocket.on('message', data => this.gotRequest(data))
        })
    }

    private gotRequest(requestData: string) {
        // console.log("[GATEWAY REQ]", requestData)
        const idx = this.interactionCount
        if (idx >= this.interactionList.length) throw new Error("The Gateway received more transactions than it should: " + (this.interactionCount + 1))
        else if (!this.interactionList[idx]) throw new Error("Mock transaction data is empty")

        this.interactionList[idx].actual = JSON.parse(requestData)

        if (!this.activeSocket) throw new Error("No socket client to reply to")

        const responseData: GatewayResponse = this.interactionList[idx].responseData
        // keep the given requestId
        responseData.requestId = (this.interactionList[idx].actual as any).requestId
        // reply stringified
        this.activeSocket.send(JSON.stringify(responseData))

        this.interactionCount++
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
