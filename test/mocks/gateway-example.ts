import * as WebSocket from "ws"
import { GatewayMock, InteractionMock } from "./gateway"
const assert = require("assert")

class GatewayClient {
    initializing: Promise<void>
    connection: WebSocket

    constructor(url) {
        this.connection = new WebSocket(url)

        this.initializing = new Promise(resolve => {
            this.connection.on('open', () => {
                resolve()
                this.initializing = null
            })
            this.connection.on('message', data => this.gotResponse(data))
        })
    }

    gotResponse(data) {
        console.log("[CLIENT] >", data)
    }

    async sendMessage(message) {
        if (this.initializing) await this.initializing

        this.connection.send(message)

        return new Promise(resolve => setTimeout(resolve, 100))
    }
}

// EXAMPLE CODE

async function main() {
    const port = 8000
    const gatewayUrl = "ws://localhost:" + port

    // START WS MOCK SERVER
    const interactionList: InteractionMock[] = [
        { expected: "I HAVE A REQUEST", responseData: "GOOD MORNING, REQUEST 1" },
        { expected: JSON.stringify({ hello: "world" }), responseData: JSON.stringify({ ok: true }) },
    ]
    const gatewayServer = new GatewayMock({ port, interactionList })

    // CONNECT WS CLIENT (or your WS library)
    try {
        const client = new GatewayClient(gatewayUrl)
        await client.sendMessage("I HAVE A REQUEST")
        await client.sendMessage(JSON.stringify({ hello: "world" }))

        assert.equal(gatewayServer.interactionCount, 2, "Interaction count does not match")

        for (let tx of gatewayServer.interactionList) {
            assert.equal(tx.expected, tx.actual, "MISMATCH")
        }
    }
    catch (err) {
        console.error(err)
    }

    gatewayServer.stop()
}

main()
