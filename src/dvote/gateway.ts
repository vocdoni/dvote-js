// NOTE:
// 
// This component is meant to be a simple communication wrapper.
// It should be agnostic to any logic invoving an Entity or a Voting Process.

import * as WebSocket from "ws"
import { parseURL } from 'universal-parse-url'
import { Wallet, utils, providers } from "ethers"

type GatewayMethod = "fetchFile" | "addFile" | "getVotingRing" | "submitVoteEnvelope" | "getVoteStatus"

/** Parameters sent by the function caller */
interface RequestParameters {
    method: GatewayMethod,

    type?: string,
    processId?: string,
    publicKeyModulus?: number,
    uri?: string,
    content?: string,
    relayAddress?: string,
    encryptedEnvelope?: string,
    nullifier?: string,

    // signature (unconfirmed)
    address?: string,
    signature?: string
}

/** What is actually sent by sendMessage() to the Gateway */
type MessageRequestContent = {
    requestId: string
} & RequestParameters

/** Data structure of the request list */
type WsRequest = {
    id: string                           // used to track requests and responses
    resolve: (response: any) => void
    reject: (error: Error) => void,
    timeout: any
}

/** Data structure of JSON responses from the Gateway */
type GatewayResponse = {
    error: boolean,
    response: string[]
}

const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

export default class Gateway {

    // Internal variables
    private gatewayWsUri: string = null
    private webSocket: WebSocket = null
    private requestList: WsRequest[] = []  // keep track of the active requests
    private connectionPromise: Promise<void> = null   // let sendMessage wait of the socket is still not open

    /**
     * Create a Gateway object, bound to work with the given URI
     * @param gatewayWsUri A WebSocket URI endpoint
     */
    constructor(gatewayWsUri: string) {
        this.setGatewayUri(gatewayWsUri)
    }

    /**
     * Set or update the Gateway's web socket URI
     * @param gatewayWsUri 
     * @returns Promise that resolves when the socket is open
     */
    public setGatewayUri(gatewayWsUri: string): Promise<void> {
        if (!gatewayWsUri || !gatewayWsUri.match(uriPattern)) throw new Error("Invalid Gateway URI")

        const url = parseURL(gatewayWsUri)
        if (url.protocol != "ws:" && url.protocol != "wss:") throw new Error("Unsupported gateway protocol: " + url.protocol)

        // Close any previous web socket that might be open
        if (this.webSocket && this.gatewayWsUri != gatewayWsUri) {
            if (typeof this.webSocket.close == "function") this.webSocket.close()
            this.webSocket = null
            this.gatewayWsUri = null
        }

        // Set up the web socket
        const ws = new WebSocket(gatewayWsUri)

        // Keep a promise so that calls to sendMessage coming before the socket is open
        // wait until the promise is resolved
        this.connectionPromise = new Promise((resolve) => {
            ws.on('open', () => {
                // the socket is ready
                this.webSocket = ws
                this.gatewayWsUri = gatewayWsUri

                ws.on('message', data => this.gotWebSocketMessage(data))
                this.connectionPromise = null
                resolve()
            })
        })
        // if the caller of this function awaits this promise, 
        // an eventual call in sendMessage will not need to
        return this.connectionPromise
    }

    /**
     * Get the current URI of the Gateway
     */
    public getUri(): string {
        return this.gatewayWsUri
    }

    // INTERNAL METHODS

    /**
     * Send a WS message and add an entry to track its response
     * @param params JSON object to send.
     * @param timeout Amount of seconds to wait before failing. (default: 30)
     */
    private async sendMessage(params: RequestParameters, timeout: number = 30): Promise<GatewayResponse> {
        if (typeof params != "object") return Promise.reject(new Error("The payload should be a javascript object"))

        const requestId = utils.keccak256('0x' + Date.now().toString(16))
        const content: MessageRequestContent = Object.assign({}, params, { requestId })

        if (this.connectionPromise) {
            // wait until the socket is open
            // useful if the GW object has just been initialized
            await this.connectionPromise
        }
        if (!this.webSocket) return Promise.reject(new Error("The gateway connection is not yet available"))

        return new Promise((resolve, reject) => {
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

            this.webSocket.send(JSON.stringify(content))
        })
    }

    /**
     * Handle incoming WS messages and link them to their original request
     * @param data 
     */
    private gotWebSocketMessage(data: WebSocket.Data) {
        let response
        try {
            if (typeof data != "string") data = data.toString()
            response = JSON.parse(data)
        }
        catch (err) {
            console.error("JSON parsing error:", err)
            throw err
        }

        if (!response || !response.requestId) return console.error("Invalid WS response:", response)

        const request = this.requestList.find(r => r.id == response.requestId)
        if (!request) return // it may have timed out

        clearTimeout(request.timeout)
        delete request.reject
        delete request.timeout

        // remove from the list
        this.requestList = this.requestList.filter(r => r.id != response.requestId)

        request.resolve(response)
        delete request.resolve
    }

    // PUBLIC FILE METHODS

    /**
     * Fetch static data from the given Content URI. 
     * 
     * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
     * 
     * @param contentUri
     * @returns base64 encoded string
     */
    public fetchFile(contentUri: string): Promise<string> {
        if (!contentUri) return Promise.reject(new Error("Invalid Content URI"))

        // See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api

        const params: RequestParameters = {
            method: "fetchFile",
            uri: contentUri
        }

        return this.sendMessage(params).then(message => {
            if (message.error) throw new Error("The data could not be fethed")
            else if (!message.response) throw new Error("The data could not be fethed")

            return message.response[0]
        })
    }

    /**
     * Upload static data to decentralized P2P filesystems. 
     * 
     * See https://vocdoni.io/docs/#/architecture/components/gateway?id=add-file
     * 
     * @param payload Base64 encoded data
     * @param type What type of P2P protocol should be used
     * @param wallet An Ethers.js wallet capable of signing the payload
     * @return The content URI of the newly added file
     */
    public async addFile(base64Payload: string, fsType: "swarm" | "ipfs", wallet: Wallet): Promise<string> {
        if (!base64Payload) throw new Error("Empty payload")
        else if (!fsType) throw new Error("Empty type")
        else if (!wallet) throw new Error("Empty wallet")

        const address = await wallet.getAddress()
        const signature = await wallet.signMessage(base64Payload)

        const params: RequestParameters = {
            method: "addFile",
            type: fsType,
            content: base64Payload,
            address,
            signature
        }

        return this.sendMessage(params).then(message => {
            if (message.error) throw new Error("The data could not be fethed")
            else if (!message.response) throw new Error("The data could not be fethed")

            return message.response[0]
        })
    }

    // GENERIC MESSAGING

    /**
     * Send a message to the Gateway using WS. Used by specific operations that need
     * the messaging capabilities. 
     * See http://vocdoni.io/docs/#/architecture/components/gateway?id=vote-api
     * 
     * @param params RequestParameters of the request
     * @return The content URI of the newly added file
     */
    public async request(params: RequestParameters): Promise<string> {
        return this.sendMessage(params).then(message => {
            if (message.error) throw new Error("There was an error while handling the request")
            else if (message.response) throw new Error("There was an error while handling the request")

            return message.response[0]
        })
    }

    // WEB3 PROVIDER

    public getEthereumProvider(protocol = "https://"): providers.JsonRpcProvider {
        const url = parseURL(this.gatewayWsUri)
        if (url.host) throw new Error("Empty gateway host: " + url.host)

        const providerUrl = protocol + url.host + url.pathname + url.search + url.hash

        return new providers.JsonRpcProvider(providerUrl)
    }
}
