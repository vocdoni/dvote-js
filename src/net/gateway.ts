// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import * as WebSocket from "isomorphic-ws"
import { parseURL } from 'universal-parse-url'
import { Buffer } from 'buffer'
import { Contract, ContractFactory, providers, utils, Wallet, Signer } from "ethers"
import { providerFromUri } from "../util/providers"
import GatewayURI from "../util/gateway-uri"

/**
 * Retrieve a list of curently active gateways for the given entityAddress
 */
export async function getActiveBaseGateways(entityAddress: string): Promise<GatewayURI[]> {
    throw new Error("TODO: unimplemented") // TODO: getActiveBaseGateways()
}

/** Data structure of the request list */
type WsRequest = {
    id: string                           // used to track requests and responses
    resolve: (response: GatewayResponse) => void
    reject: (error: Error) => void,
    timeout: any
}

type GatewayMethod = "fetchFile" | "addFile" | "submitVoteEnvelope" | "getVoteStatus" | "addCensus" // "getVotingRing"

/** Parameters sent by the function caller */
export interface RequestParameters {
    // Common
    method: GatewayMethod,
    timestamp?: number,

    [k: string]: any
}

/** What is actually sent by sendMessage() to the Gateway */
type MessageRequestContent = {
    id: string,
    request: RequestParameters,
    signature?: string
}

/** Data structure of JSON responses from the Gateway */
type GatewayResponse = {
    id: string,
    error?: {
        request: string,
        message: string,
        timestamp: number
    },
    response?: any,
    signature: string
}

const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over Web Sockets
 * intended to interact within voting processes
 */
export class VocGateway {
    private publicKey: string = null
    private uri: string = null
    private webSocket: WebSocket = null
    private requestList: WsRequest[] = []  // keep track of the active requests
    private connectionPromise: Promise<void> = null   // let sendMessage wait of the socket is still not open

    constructor(uri: string, publicKey: string = null) {
        if (publicKey) this.publicKey = publicKey

        this.connect(uri)
    }

    /**
     * Set or update the Gateway's web socket URI
     * @param gatewayWsUri 
     * @returns Promise that resolves when the socket is open
     */
    public connect(uri: string): Promise<void> {
        if (!uri) throw new Error("The gateway URI is required")
        else if (!uri.match(uriPattern)) throw new Error("Invalid Gateway URI")

        // Close any previous web socket that might be open
        this.disconnect()

        const url = parseURL(uri)
        if (url.protocol != "ws:" && url.protocol != "wss:") throw new Error("Unsupported gateway protocol: " + url.protocol)

        // Keep a promise so that calls to sendMessage coming before the socket is open
        // wait until the promise is resolved
        this.connectionPromise = new Promise((resolve, reject) => {
            // Set up the web socket
            const ws = new WebSocket(uri)
            ws.onopen = () => {
                // the socket is ready
                this.webSocket = ws
                this.uri = uri

                ws.onmessage = msg => {
                    // Detect behavior on Browser/NodeJS
                    if (!msg || !msg.data) throw new Error("Invalid response message")

                    if (typeof msg.data == "string") {
                        this.gotWebSocketMessage(msg.data)
                    }
                    else if (msg.data instanceof Buffer || msg.data instanceof Uint8Array) {
                        this.gotWebSocketMessage(msg.data.toString())
                    }
                    else if (typeof Blob != "undefined" && msg.data instanceof Blob) {
                        const reader = new FileReader()
                        reader.onload = () => {
                            this.gotWebSocketMessage(reader.result as string)
                        }
                        reader.readAsText(msg.data) // JSON
                    }
                    else {
                        console.error("Unsupported response", typeof msg.data, msg.data)
                    }
                }
                this.connectionPromise = null
                resolve()
            }
            ws.onerror = (err) => reject(err)
            ws.onclose = () => reject(new Error("Connection closed"))
        })

        // if the caller of this function awaits this promise, 
        // an eventual call in sendMessage will not need to
        return this.connectionPromise
    }

    /** Close the current connection */
    public disconnect() {
        if (!this.webSocket) return
        else if (typeof this.webSocket.close == "function") this.webSocket.close()
        this.webSocket = null
        this.uri = null
    }

    /**
     * Get the current URI of the Gateway
     */
    public async getUri(): Promise<string> {
        if (this.connectionPromise) await this.connectionPromise

        return this.uri
    }

    /**
     * Send a WS message to a Vocdoni Gateway and add an entry to track its response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param timeout (optional) Timeout in seconds to wait before failing (default: 50)
     */
    public async sendMessage(requestBody: RequestParameters, wallet: Wallet | Signer = null, timeout: number = 50): Promise<any> {
        if (typeof requestBody != "object") return Promise.reject(new Error("The payload should be a javascript object"))
        else if (typeof wallet != "object") return Promise.reject(new Error("The wallet is required"))
        if (this.connectionPromise) {
            await this.connectionPromise
        }

        if (!this.webSocket) return Promise.reject(new Error("The gateway connection is not yet available"))

        // Append the current timestamp to the body
        if (typeof requestBody.timestamp == "undefined") {
            requestBody.timestamp = Math.floor(Date.now() / 1000)
        }

        const requestId = utils.keccak256('0x' + Date.now().toString(16)).substr(2)
        const content: MessageRequestContent = {
            id: requestId,
            request: requestBody,
            signature: undefined
        }
        if (wallet) {
            content.signature = await signRequestBody(requestBody, wallet)
        }

        const reqPromise = new Promise((resolve, reject) => {
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

        const msg = (await reqPromise) as GatewayResponse

        const incomingReqId = msg.response ? msg.response.request : (msg.error ? msg.error.request : null)
        if (incomingReqId !== requestId) {
            throw new Error("The signed request ID does not match the expected one")
        }

        // Check the signature of the response
        if (this.publicKey) {
            const timestamp = msg.response ? msg.response.timestamp : (msg.error ? msg.error.timestamp : null)

            const from = Math.floor(Date.now() / 1000) - 10
            const until = Math.floor(Date.now() / 1000) + 10
            if (typeof timestamp != "number" || timestamp < from || timestamp > until) {
                throw new Error("The response does not provide a valid timestamp")
            }

            if (msg.response) {
                if (!this.isSignatureValid(msg.signature, msg.response)) {
                    throw new Error("The signature of the response does not match the expected one")
                }
            }
            else if (msg.error) {
                if (!this.isSignatureValid(msg.signature, msg.error)) {
                    throw new Error("The signature of the response does not match the expected one")
                }
            }
        }

        if (msg.error) {
            if (msg.error.message) throw new Error(msg.error.message)
            else throw new Error("There was an error while handling the request")
        }
        else if (!msg.response) {
            throw new Error("Received an empty response")
        }

        return msg.response
    }

    // PRIVATE METHODS

    /**
     * Handle incoming WS messages and link them to their original request
     * @param strResponse JSON response contents
     */
    private gotWebSocketMessage(strResponse: string) {
        let response
        try {
            response = JSON.parse(strResponse)
        }
        catch (err) {
            console.error("JSON parsing error:", err)
            throw err
        }

        if (!response || !response.id) return console.error("Invalid Gateway response:", response)

        const request = this.requestList.find(r => r.id == response.id)
        if (!request) return // it may have timed out

        clearTimeout(request.timeout)
        delete request.reject
        delete request.timeout

        // remove from the list
        this.requestList = this.requestList.filter(r => r.id != response.id)

        // The request payload is handled in `sendMessage`
        request.resolve(response)
        delete request.resolve
    }

    /**
     * 
     * @param signature Hex encoded signature (created with the Ethereum prefix)
     * @param responseBody JSON object of the `response` or `error` fields
     */
    private isSignatureValid(signature: string, responseBody: any): boolean {
        if (!this.publicKey) return true
        else if (!signature) return false

        const gwPublicKey = this.publicKey.startsWith("0x") ? this.publicKey : "0x" + this.publicKey
        const expectedAddress = utils.computeAddress(gwPublicKey)

        responseBody = sortObjectFields(responseBody)
        let strBody: string
        if (typeof responseBody != "string") strBody = JSON.stringify(responseBody)
        else strBody = responseBody

        const actualAddress = utils.verifyMessage(strBody, signature)

        return actualAddress && expectedAddress && (actualAddress == expectedAddress)
    }
}

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over Web Sockets
 * intended to interact with a Census Service.
 * Currently, it directly inherits from VocGateway
 */
export class CensusGateway extends VocGateway { }

export class Web3Gateway {
    private provider: providers.Provider

    /** Returns a JSON RPC provider that can be used for Ethereum communication */
    public static providerFromUri(uri: string) {
        return providerFromUri(uri)
    }

    constructor(params: { gatewayUri?: string, provider?: providers.Provider } = {}) {
        if (!params) throw new Error("Invalid params")

        const { gatewayUri, provider } = params

        if (!gatewayUri && !provider) throw new Error("A gateway URI or a provider is required")
        else if (gatewayUri) {
            if (!gatewayUri.match(uriPattern)) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayUri)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this.provider = Web3Gateway.providerFromUri(gatewayUri)
        }
        else { // use provider
            this.provider = provider
        }
    }

    /**
     * Deploy the contract using the given signer or wallet.
     * If a signer is given, its current connection will be used.
     * If a wallet is given, the Gateway URI will be used unless the wallet is already connected
     */
    async deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {
        var contractFactory: ContractFactory

        if (!signParams) throw new Error("Invalid signing parameters")
        let { signer, wallet } = signParams
        if (!signer && !wallet) throw new Error("A signer or a wallet is needed")
        else if (signer) {
            if (!signer.provider) throw new Error("A signer connected to a RPC provider ")

            contractFactory = new ContractFactory(abi, bytecode, signer)
        }
        else { // wallet
            if (!wallet.provider) {
                wallet = new Wallet(wallet.privateKey, this.provider)
            }

            contractFactory = new ContractFactory(abi, bytecode, wallet)
        }
        return (await contractFactory.deploy(deployArguments)) as (Contract & CustomContractMethods)
    }

    /**
     * Use the contract instance at the given address using the Gateway as a provider
     * @param address Contract instance address
     * @return A contract instance attached to the given address
     */
    attach<CustomContractMethods>(address: string, abi: string | (string | utils.ParamType)[] | utils.Interface): (Contract & CustomContractMethods) {
        if (typeof address != "string") throw new Error("Invalid contract address")
        else if (!abi) throw new Error("Invalid contract ABI")

        return new Contract(address, abi, this.provider) as (Contract & CustomContractMethods)
    }

    /** Returns a JSON RPC provider associated to the initial Gateway URI */
    public getProvider() {
        return this.provider
    }
}


///////////////////////////////////////////////////////////////////////////////
// INTERNAL HELPERS
///////////////////////////////////////////////////////////////////////////////

function signRequestBody(request: RequestParameters, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!walletOrSigner) throw new Error("Invalid wallet/signer")

    request = sortObjectFields(request)
    const msg = JSON.stringify(request)
    return walletOrSigner.signMessage(msg)
}

function sortObjectFields(data: any) {
    switch (typeof data) {
        case "bigint":
        case "boolean":
        case "function":
        case "number":
        case "string":
        case "symbol":
        case "undefined":
            return data;
    }

    // Ensure ordered key names
    return Object.keys(data).sort().reduce((prev, cur) => {
        prev[cur] = sortObjectFields(data[cur])
        return prev
    }, {})
}