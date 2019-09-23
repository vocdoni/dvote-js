// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import * as WebSocket from "isomorphic-ws"
import { parseURL } from 'universal-parse-url'
import { Buffer } from 'buffer'
import { Contract, ContractFactory, providers, utils, Wallet, Signer } from "ethers"
import { providerFromUri } from "../util/providers"
import GatewayInfo from "../wrappers/gateway-info"
import { DVoteSupportedApi, WsGatewayMethod, fileApiMethods, voteApiMethods, censusApiMethods } from "../models/gateway"
import { SIGNATURE_TIMESTAMP_TOLERANCE } from "../constants"
import { signJsonBody, isSignatureValid } from "../util/json-sign"

const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

///////////////////////////////////////////////////////////////////////////////
// DVOTE GATEWAY
///////////////////////////////////////////////////////////////////////////////

/** Parameters sent by the function caller */
export interface DvoteRequestParameters {
    // Common
    method: WsGatewayMethod,
    timestamp?: number,

    [k: string]: any
}

/** Data structure of the request list */
type WsRequest = {
    id: string                           // used to track requests and responses
    resolve: (response: GatewayResponse) => void
    reject: (error: Error) => void,
    timeout: any
}

/** What is actually sent by sendMessage() to the Gateway */
type MessageRequestContent = {
    id: string,
    request: DvoteRequestParameters,
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

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over Web Sockets
 * intended to interact within voting processes
 */
export class DVoteGateway {
    protected uri: string = ""
    protected supportedApis: DVoteSupportedApi[] = []
    protected pubKey: string = ""

    private webSocket: WebSocket = null
    private connectionPromise: Promise<void> = null   // let sendMessage wait of the socket is still not open
    private requestList: WsRequest[] = []  // keep track of the active requests

    /** 
     * Returns a new DVote Gateway web socket client
     * @param gatewayOrParams Either a GatewayInfo instance or a JSON object with the service URI, the supported API's and the public key
     */
    constructor(gatewayOrParams: GatewayInfo | { uri: string, supportedApis: DVoteSupportedApi[], publicKey?: string }) {
        if (gatewayOrParams instanceof GatewayInfo) {
            this.uri = gatewayOrParams.dvote
            this.supportedApis = gatewayOrParams.supportedApis
            this.pubKey = gatewayOrParams.publicKey
        }
        else {
            const { uri, supportedApis, publicKey } = gatewayOrParams
            if (!uriPattern.test(uri)) throw new Error("Invalid gateway URI")

            this.uri = uri
            this.supportedApis = supportedApis
            this.pubKey = publicKey || ""
        }
    }

    /**
     * Connect to the URI defined in the constructor. If a URI is given, discard the previour one and connect to the new one.
     * @param gatewayOrParams (optional) If set, connect to the given coordinates
     * @returns Promise that resolves when the socket is open
     */
    public connect(gatewayOrParams?: GatewayInfo | { uri: string, supportedApis: DVoteSupportedApi[], publicKey?: string }): Promise<void> {
        let newUri: string, newSupportedApis: DVoteSupportedApi[], newPublicKey: string

        if (gatewayOrParams) {
            if (gatewayOrParams instanceof GatewayInfo) {
                newUri = gatewayOrParams.dvote
                newSupportedApis = gatewayOrParams.supportedApis
                newPublicKey = gatewayOrParams.publicKey
            }
            else {
                const { uri, supportedApis, publicKey } = gatewayOrParams
                if (!uriPattern.test(uri)) throw new Error("Invalid Gateway URI")

                newUri = uri
                newSupportedApis = supportedApis
                newPublicKey = publicKey
            }
        }
        else if (!this.uri) throw new Error("The details of a gateway are needed in order to connect to it")
        else {
            newUri = this.uri
            newSupportedApis = this.supportedApis || []
            newPublicKey = this.publicKey || ""
        }


        // Close any previous web socket that might be open
        this.disconnect()

        const url = parseURL(newUri)
        if (url.protocol != "ws:" && url.protocol != "wss:") throw new Error("Unsupported gateway protocol: " + url.protocol)

        // Keep a promise so that calls to sendMessage coming before the socket is open
        // wait until the promise is resolved
        this.connectionPromise = new Promise((resolve, reject) => {
            // Set up the web socket
            const ws = new WebSocket(newUri)
            ws.onopen = () => {
                // the socket is ready
                this.webSocket = ws
                this.uri = newUri
                this.supportedApis = newSupportedApis
                this.pubKey = newPublicKey

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
     * Check whether the client is effectively connected to a Gateway
     */
    public async isConnected(): Promise<boolean> {
        if (this.connectionPromise) await this.connectionPromise

        return this.webSocket != null && this.uri != null
    }

    /**
     * Get the current URI of the Gateway
     */
    public async getUri(): Promise<string> {
        if (this.connectionPromise) await this.connectionPromise

        return this.uri
    }

    public get publicKey() { return this.pubKey }

    /**
     * Send a WS message to a Vocdoni Gateway and add an entry to track its response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param timeout (optional) Timeout in seconds to wait before failing (default: 50)
     */
    public async sendMessage(requestBody: DvoteRequestParameters, wallet: Wallet | Signer = null, timeout: number = 50): Promise<any> {
        if (typeof requestBody != "object") return Promise.reject(new Error("The payload should be a javascript object"))
        else if (typeof wallet != "object") return Promise.reject(new Error("The wallet is required"))

        if (!(await this.isConnected())) {
            await this.connect()
        }

        if (!this.webSocket) return Promise.reject(new Error("The gateway connection is not yet available"))

        // Check API method availability
        if ((fileApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("file") < 0) ||
            (voteApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("vote") < 0) ||
            (censusApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("census") < 0)
        ) throw new Error("The method is not available in the Gateway's supported API's")

        // Append the current timestamp to the body
        if (typeof requestBody.timestamp == "undefined") {
            requestBody.timestamp = Math.floor(Date.now() / 1000)
        }

        const requestId = utils.keccak256('0x' + Date.now().toString(16)).substr(2)
        const content: MessageRequestContent = {
            id: requestId,
            request: requestBody,
            signature: ""
        }
        if (wallet) {
            content.signature = await signJsonBody(requestBody, wallet)
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

            const from = Math.floor(Date.now() / 1000) - SIGNATURE_TIMESTAMP_TOLERANCE
            const until = Math.floor(Date.now() / 1000) + SIGNATURE_TIMESTAMP_TOLERANCE
            if (typeof timestamp != "number" || timestamp < from || timestamp > until) {
                throw new Error("The response does not provide a valid timestamp")
            }

            if (msg.response) {
                if (!isSignatureValid(msg.signature, this.publicKey, msg.response)) {
                    throw new Error("The signature of the response does not match the expected one")
                }
            }
            else if (msg.error) {
                if (!isSignatureValid(msg.signature, this.publicKey, msg.error)) {
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
}

/**
 * A Web3 wrapped client with utility methods to deploy and attach to Ethereum contracts.
 */
export class Web3Gateway {
    private provider: providers.Provider

    /** Returns a JSON RPC provider that can be used for Ethereum communication */
    public static providerFromUri(uri: string) {
        return providerFromUri(uri)
    }

    /**
     * Returns a wrapped Ethereum Web3 client.
     * @param gatewayOrProvider Can be a string with the host's URI or an Ethers Provider
     */
    constructor(gatewayOrProvider: string | GatewayInfo | providers.Provider) {
        if (!gatewayOrProvider) throw new Error("Invalid Gateway or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider.match(uriPattern)) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this.provider = Web3Gateway.providerFromUri(gatewayOrProvider)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this.provider = Web3Gateway.providerFromUri(gatewayOrProvider.web3)
        }
        else if (gatewayOrProvider instanceof providers.Provider) { // use as a provider
            this.provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
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
