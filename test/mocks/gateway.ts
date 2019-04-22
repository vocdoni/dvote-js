import * as WebSocket from "ws"

type ConstructorParams = {
    port: number,
    interactionList: InteractionMock[]
}
export type InteractionMock = {
    expected: string,         // What the client should send
    actual?: string,           // What the client actually sent
    responseData: string     // What to send as a response
}

// THE GATEWAY SERVER MOCK

export class GatewayMock {
    private socketServer: WebSocket.Server = null
    private activeSocket: any = null
    public interactionList: InteractionMock[] = []
    public interactionCount: number = 0

    constructor(params: ConstructorParams) {
        this.socketServer = new WebSocket.Server({ port: params.port || 8000 })
        this.interactionList = params.interactionList

        this.socketServer.on('connection', socket => {
            this.activeSocket = socket
            this.activeSocket.on('message', data => this.gotRequest(data))
        })
    }

    gotRequest(requestData: string) {
        // console.log("[GATEWAY] GOT", requestData)
        const idx = this.interactionCount
        if (idx >= this.interactionList.length) throw new Error("The Gateway received more transactions than it should: " + (this.interactionCount + 1))
        else if (!this.interactionList[idx]) throw new Error("Mock transaction data is empty")

        this.interactionList[idx].actual = requestData

        if (!this.activeSocket) throw new Error("No socket client to reply to")
        this.activeSocket.send(this.interactionList[idx].responseData)

        this.interactionCount++
    }

    stop() {
        if (!this.socketServer) throw new Error("Socket server not started")
        this.socketServer.close()
    }
}
