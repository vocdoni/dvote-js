// NOTE:
// 
// This component is meant to be a simple communication wrapper.
// It should be agnostic to any logic invoving an Entity or a Voting Process.

import WebSocket from "ws"
import { parseURL } from 'universal-parse-url'
import { Wallet, utils } from "ethers"

type WsRequest = {
    id: number
    resolve: (response: any) => void
    reject: (error: Error) => void,
    timeout: any
}

const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

export default class Gateway {

    // internal variables
    gatewayUri: string = null
    webSocket: WebSocket = null
    requestList: WsRequest[] = []  // keep track of the active requests
    requestCounter: number = 0     // to assign unique request id's

    /**
     * Create a Gateway object, bound to work with the given URI
     * @param gatewayUri A WebSocket URI endpoint
     */
    constructor(gatewayUri: string) {
        if (!gatewayUri || !gatewayUri.match(uriPattern)) throw new Error("Invalid Gateway URI")

        const url = parseURL(gatewayUri)
        if (url.protocol != "ws:" && url.protocol != "wss:") throw new Error("Unsupported gateway protocol: " + url.protocol)

        this.gatewayUri = gatewayUri

        // Set up the web socket
        const ws = new WebSocket(this.gatewayUri)

        ws.on('open', () => {
            // the socket is ready
            this.webSocket = ws

            ws.on('message', data => this.gotWebSocketMessage(data))
        })
    }

    /**
     * Send a WS message and add an entry to track its response
     * @param data JSON object to send. "requestId" will be appended on it
     * @param timeout Amount of seconds to wait before failing. (default: 30)
     */
    private sendMessage(data, timeout: number = 30): Promise<string> {
        if (!this.webSocket) return Promise.reject(new Error("The gateway connection is not yet available"))
        else if (typeof data != "object") return Promise.reject(new Error("The payload should be a javascript object"))

        return new Promise((resolve, reject) => {
            const requestId = this.requestCounter
            this.requestCounter++

            this.requestList.push({
                id: requestId,
                resolve,
                reject,
                timeout: setTimeout(() => {
                    reject(new Error("Request timed out"))
                    // remove from the list
                    this.requestList = this.requestList.filter(r => r.id != requestId)
                }, timeout * 1000)
            })

            // appending the request ID
            data.requestId = requestId

            this.webSocket.send(JSON.stringify(data))
        })
    }

    /**
     * Handle incoming WS messages and link them to their original request
     * @param data 
     */
    private gotWebSocketMessage(data: string) {
        let response
        try {
            response = JSON.parse(data)
        }
        catch (err) {
            console.error("JSON parsing error:", err)
            throw err
        }

        if(!response || !response.requestId) return console.error("Invalid WS response:", response)

        const request = this.requestList.find(r => r.id == response.requestId)
        if (!request) return // it may have timed out

        clearTimeout(request.timeout)
        delete request.reject

        // remove from the list
        this.requestList = this.requestList.filter(r => r.id != response.requestId)

        request.resolve(response)
        delete request.resolve
    }

    // PUBLIC METHODS

    /**
     * Fetch static data from the given Content URI
     * @param contentUri
     */
    public async fetchFile(contentUri: string): Promise<string> {
        if (!contentUri) throw new Error("Invalid Content URI")

        // https://github.com/websockets/ws#usage-examples
        // TODO: Integrate with https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api


        // TODO: DECODE base 64

        throw new Error("unimplemented")
    }

    /**
     * Fetch static data from the given Content URI
     * @param contentUri
     * @return The content URI of the newly added file
     */
    public async addFile(payload: string, type: "swarm" | "ipfs", wallet: Wallet): Promise<ContentURI> {
        if (!payload) throw new Error("Empty payload")
        else if (!type) throw new Error("Empty type")
        else if (!wallet) throw new Error("Empty wallet")

        const address = await wallet.getAddress()
        const signature = await wallet.sign({ data: payload })

        // https://github.com/websockets/ws#usage-examples
        // TODO: Integrate with https://vocdoni.io/docs/#/architecture/components/gateway?id=add-file

        // TODO: Encode base 64
        throw new Error("unimplemented")
    }

    // SPECIFIC OPERATION HANDLERS

    // TODO: Get Voting Ring
    // TODO: Submit Vote Envelope
    // TODO: Get Vote Status
    // TODO: Fetch File
    // TODO: Add File

    // TODO: web3Provider
}
