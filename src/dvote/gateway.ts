// NOTE:
// 
// This component is meant to be a simple communication wrapper.
// It should be agnostic to any logic invoving an Entity or a Voting Process.

import * as WebSocket from "ws"
import { parseURL } from 'universal-parse-url'
import { Wallet, utils, providers } from "ethers"
import { rejects } from "assert";

type GatewayMethod = "fetchFile" | "addFile" | "getVotingRing" | "submitVoteEnvelope" | "getVoteStatus"

/** Parameters sent by the function caller */
interface RequestParameters {
    // Common
    method: GatewayMethod,
    timestamp?: number,

    // Voting
    processId?: string,
    publicKeyModulus?: number,
    relayAddress?: string,
    encryptedEnvelope?: string,
    nullifier?: string,

    // Fetch file
    uri?: string,  // Content URI

    // Add file
    type?: string,   // storage type (ipfs/swarm)
    name?: string,   // name of the file
    content?: string,  // base64 file content
}

/** What is actually sent by sendMessage() to the Gateway */
type MessageRequestContent = {
    id: string,
    request: RequestParameters,
    signature?: string
}

/** Data structure of the request list */
type WsRequest = {
    id: string                           // used to track requests and responses
    resolve: (response: any) => void
    reject: (error: Error) => void,
    timeout: any
}

/** Data structure of JSON responses from the Gateway */
type GatewayResponse = {
    id: string,
    error?: {
        requestId: string,
        message: string
    },
    response?: any
}

type EthereumProviderParams = {
    uri?: string,
    protocol?: "https" | "http" | "wss" | "ws",
    port?: number
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

    // WEB3 PROVIDER

    /**
     * Returns an Ethereum JSON RPC provider pointing to the Gateway
     * @param uri The URI of the endpoint
     */
    public static ethereumProvider(uri: string): providers.JsonRpcProvider {
        if (!uri) throw new Error("Invalid URI")

        return new providers.JsonRpcProvider(uri)
    }

    /**
     * Returns an Ethereum JSON RPC provider pointing to the Gateway. Parts of the original URI can be overridden
     * @param params By default, will return an http client on port 8545 with the current hostname, pathname, search and hash. 
     *      "protocol" and "port" can be overriden. 
     *      Entering a "uri" will ignore any other value of the current web socket URI and return a decoupled RPC client
     */
    public static ethereumProviderFromGateway(gateway: Gateway, params: EthereumProviderParams = { protocol: "ws", port: 8545 }): providers.JsonRpcProvider {
        if (!gateway) throw new Error("Invalid gateway provided")

        const currentUri = parseURL(gateway.gatewayWsUri)
        if (!currentUri.host) throw new Error("Empty gateway host: " + currentUri.host)

        let providerUri = ""
        switch (params && params.protocol) {
            case "http": providerUri = "http://"; break
            case "https": providerUri = "https://"; break
            case "ws": providerUri = "ws://"; break
            case "wss": providerUri = "wss://"; break
            default: providerUri = "ws://"; break
        }
        if (params && params.port) {
            providerUri += currentUri.hostname + ":" + params.port
        }
        else {
            providerUri += currentUri.hostname + ":8545"
        }

        providerUri += currentUri.pathname + currentUri.search + currentUri.hash

        return new providers.JsonRpcProvider(providerUri)
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
        this.connectionPromise = new Promise((resolve, reject) => {
            ws.on('open', () => {
                // the socket is ready
                this.webSocket = ws
                this.gatewayWsUri = gatewayWsUri

                ws.on('message', data => this.gotWebSocketMessage(data))
                this.connectionPromise = null
                resolve()
            })
            ws.on("error", (err) => reject(err))
            ws.on("close", () => reject(new Error("Connection closed")))
        })
        // if the caller of this function awaits this promise, 
        // an eventual call in sendMessage will not need to
        return this.connectionPromise
    }

    /**
     * Get the current URI of the Gateway
     */
    public async getUri(): Promise<string> {
        if (this.connectionPromise) await this.connectionPromise

        return this.gatewayWsUri
    }

    // INTERNAL METHODS

    /**
     * Send a WS message and add an entry to track its response
     * @param requestBody Parameters of the request to send
     * @param timeout Timeout in seconds to wait before failing (default: 50)
     */
    private async sendMessage(requestBody: RequestParameters, timeout: number = 50): Promise<GatewayResponse> {
        if (typeof requestBody != "object") return Promise.reject(new Error("The payload should be a javascript object"))

        const requestId = utils.keccak256('0x' + Date.now().toString(16)).substr(2)
        const content: MessageRequestContent = {
            id: requestId,
            request: requestBody
        }

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
     * Send a WS message and add an entry to track its response
     * @param requestBody Parameters of the request to send
     * @param wallet The wallet to use for signing
     * @param timeout Timeout in seconds to wait before failing (default: 50)
     */
    private async sendSignedMessage(requestBody: RequestParameters, wallet: Wallet, timeout: number = 50): Promise<GatewayResponse> {
        if (typeof requestBody != "object") return Promise.reject(new Error("The payload should be a javascript object"))
        if (typeof wallet != "object") return Promise.reject(new Error("The wallet is required"))

        const requestId = utils.keccak256('0x' + Date.now().toString(16)).substr(2)
        const signature = await this.signRequestBody(requestBody, wallet)

        const content: MessageRequestContent = {
            id: requestId,
            request: requestBody,
            signature
        }

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

        if (!response || !response.id) return console.error("Invalid WS response:", response)

        const request = this.requestList.find(r => r.id == response.id)
        if (!request) return // it may have timed out

        // TODO: CHECK THE SIGNATURE OF THE RESPONSE
        console.warn("TO DO: CHECK THE SIGNATURE OF THE RESPONSE")

        clearTimeout(request.timeout)
        delete request.reject
        delete request.timeout

        // remove from the list
        this.requestList = this.requestList.filter(r => r.id != response.id)

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
            if (message.error) {
                if (message.error.message) throw new Error(message.error.message)
                else throw new Error("The data could not be fetched")
            }
            else if (!message.response || !message.response.content) throw new Error("The data could not be fetched")

            return message.response.content
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
    public async addFile(base64Payload: string, name: string, fsType: "swarm" | "ipfs", wallet: Wallet): Promise<any> {
        if (!base64Payload) throw new Error("Empty payload")
        else if (!fsType) throw new Error("Empty type")

        const requestBody: RequestParameters = {
            method: "addFile",
            type: fsType,
            name,
            content: base64Payload,
            timestamp: Date.now()
        }

        return this.sendSignedMessage(requestBody, wallet).then(message => {
            if (message.error) {
                if (message.error.message) throw new Error(message.error.message)
                else throw new Error("The data could not be uploaded")
            }
            else if (!message.response || !message.response.uri) throw new Error("The data could not be uploaded")

            return message.response.uri
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
    public async request(params: RequestParameters): Promise<any> {
        return this.sendMessage(params).then(message => {
            if (message.error) {
                if (message.error.message) throw new Error(message.error.message)
                else throw new Error("There was an error while handling the request")
            }
            else if (message.error) {
                throw new Error(message.response && message.response[0] || "There was an error while handling the request")
            }

            return message.response
        })
    }

    /**
     * Closes the WS connection if it is currently active
     */
    public disconnect() {
        if (!this.webSocket || !this.webSocket.close) return
        this.webSocket.close()
    }

    private signRequestBody(request: RequestParameters, wallet: Wallet): Promise<string> {
        if (!wallet) throw new Error("Invalid wallet")

        // Ensure ordered key names
        request = Object.keys(request).sort().reduce((prev, cur) => {
            prev[cur] = request[cur]
            return prev
        }, {} as RequestParameters)

        const msg = JSON.stringify(request)
        return wallet.signMessage(msg)
    }
}
