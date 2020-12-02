// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import * as WebSocket from "isomorphic-ws"
import { parseURL } from 'universal-parse-url'
import { Buffer } from 'buffer/'
import { Contract, ContractFactory, providers, utils, Wallet, Signer, ContractInterface } from "ethers"
import { providerFromUri } from "../util/providers"
import GatewayInfo from "../wrappers/gateway-info"
import { DVoteSupportedApi, WsGatewayMethod, fileApiMethods, voteApiMethods, censusApiMethods, dvoteGatewayApiMethods, resultsApiMethods } from "../models/gateway"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { signJsonBody, isValidSignature, sortObjectFields, isByteSignatureValid } from "../util/json-sign"
import { getEntityResolverInstance, getProcessInstance, IProcessContract, IEnsPublicResolverContract, INamespaceContract } from "../net/contracts"
import axios, { AxiosInstance } from "axios"
import { NetworkID, fetchDefaultBootNode, getNetworkGatewaysFromBootNodeData, fetchFromBootNode } from "./gateway-bootnodes"
import ContentURI from "../wrappers/content-uri"
import { extractUint8ArrayJSONValue } from "../util/uint8array"
import { readBlobText, readBlobArrayBuffer } from "../util/blob"
import {
    EnsPublicResolver as EntityContractDefinition,
    Process as ProcessContractDefinition,
    Namespace as NamespaceContractDefinition
} from "dvote-solidity"
import { entityResolverEnsDomain, processEnsDomain, entityResolverEnsDomainDev, processEnsDomainDev } from "../constants"

const { JsonRpcProvider, Web3Provider, IpcProvider, InfuraProvider, FallbackProvider, EtherscanProvider } = providers

// const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

///////////////////////////////////////////////////////////////////////////////
// DVOTE GATEWAY
///////////////////////////////////////////////////////////////////////////////

// Export the class typings as an interface
export type IDVoteGateway = InstanceType<typeof DVoteGateway>
export type IWeb3Gateway = InstanceType<typeof Web3Gateway>
export type IGateway = InstanceType<typeof Gateway>


/** Parameters sent by the function caller */
export interface IDvoteRequestParameters {
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

/** What is actually sent by sendRequest() to the Gateway */
type MessageRequestContent = {
    id: string,
    request: IDvoteRequestParameters,
    signature?: string
}

type GatewayResponse = {
    id: string,
    response: {
        ok: boolean,
        request: string,
        message?: string,
        timestamp?: number,
    },
    signature?: string,
    responseBytes?: Uint8Array,
}

/**
 * This is class, addressed to the end user, is a wrapper of DvoteGateway and Web3Gateway
 */
export class Gateway {
    protected dvote: DVoteGateway = null
    protected web3: Web3Gateway = null
    public get health() { return this.dvote.health }
    public get publicKey() { return this.dvote.publicKey }
    public getSupportedApis() { return this.dvote.getSupportedApis() }

    /**
     * Returns a new Gateway
     * @param dvoteGateway A DvoteGateway instance
     * @param web3Gateway A Web3Gateway instance
     */
    constructor(dvoteGateway: IDVoteGateway, web3Gateway: IWeb3Gateway) {
        if (!dvoteGateway || !web3Gateway ||
            !(dvoteGateway instanceof DVoteGateway) || !(web3Gateway instanceof Web3Gateway)) {
            throw new Error("Invalid gateways provided")
        }
        this.dvote = dvoteGateway
        this.web3 = web3Gateway
    }

    /**
     * Returns a new random *connected*(Dvote-wise) Gateway that is
     * 1. Attached to the required network
     * 2. Servers the required APIs
     * @param networkId Either "mainnet" or "goerli" (test)
     * @param requiredApis A list of the required APIs
     */
    static randomFromDefault(networkId: NetworkID, requiredApis: DVoteSupportedApi[] = [], options: { testing: boolean } = { testing: false }): Promise<Gateway> {
        return fetchDefaultBootNode(networkId)
            .then(async bootNodeData => {
                const gateways = getNetworkGatewaysFromBootNodeData(bootNodeData, networkId, options)
                let web3: Web3Gateway
                for (let i = 0; i < gateways.web3.length; i++) {
                    let w3 = gateways.web3[i]
                    const isUp = await w3.isUp().then(() => true).catch(() => false)
                    if (!isUp) continue
                    web3 = w3
                    break
                }
                if (!web3) throw new Error("Could not find an active Web3 Gateway")

                let gw: Gateway = null
                let connected = false
                do {
                    gw = new Gateway(gateways.dvote.pop(), web3)
                    connected = await gw.connect(requiredApis).catch(() => { gw.disconnect(); return false })
                } while (!connected && gateways.dvote.length)

                if (connected) return gw
                throw new Error('Could not find an active DVote gateway')
            })
    }

    /**
     * Returns a new random *connected*(Dvote-wise) Gateway that is
     * 1. Attached to the required network
     * 2. Included in the provided URI of bootnodes
     * 2. Servers the required APIs
     * @param networkId Either "mainnet" or "goerli" (test)
     * @param bootnodesContentUri The uri from which contains the available gateways
     * @param requiredApis A list of the required APIs
     */
    static randomfromUri(networkId: NetworkID, bootnodesContentUri: string | ContentURI, requiredApis: DVoteSupportedApi[] = [], options: { testing: boolean } = { testing: false }): Promise<Gateway> {
        return fetchFromBootNode(bootnodesContentUri)
            .then(async bootNodeData => {
                const gateways = getNetworkGatewaysFromBootNodeData(bootNodeData, networkId, options)
                let web3: Web3Gateway
                for (let i = 0; i < gateways.web3.length; i++) {
                    let w3 = gateways.web3[i]
                    const isUp = await w3.isUp().then(() => true).catch(() => false)
                    if (!isUp) continue
                    web3 = w3
                    break
                }
                if (!web3) throw new Error("Could not find an active Web3 Gateway")

                let gw: Gateway = null
                let connected = false
                do {
                    gw = new Gateway(gateways.dvote.pop(), web3)
                    connected = await gw.connect(requiredApis).catch(() => { gw.disconnect(); return false })
                } while (!connected && gateways.dvote.length)

                if (connected) return gw
                throw new Error('Could not find an active DVote gateway')
            })
    }

    /**
     * Returns a new *connected* Gateway that is instantiated based on the given parameters
     * @param gatewayOrParams Either a gatewayInfo object or an object with the defined parameters
     */
    static fromInfo(gatewayOrParams: GatewayInfo | { dvoteUri: string, supportedApis: DVoteSupportedApi[], web3Uri: string, publicKey?: string }, options: { testing: boolean } = { testing: false }): Promise<Gateway> {
        let dvoteGateway, web3Gateway
        if (gatewayOrParams instanceof GatewayInfo) {
            dvoteGateway = new DVoteGateway(gatewayOrParams)
            web3Gateway = new Web3Gateway(gatewayOrParams, null, options)
        } else if (gatewayOrParams instanceof Object) {
            if (!(typeof gatewayOrParams.dvoteUri === "string") ||
                !(Array.isArray(gatewayOrParams.supportedApis)) ||
                !(typeof gatewayOrParams.web3Uri === "string"))
                throw new Error("Invalid Parameters")
            dvoteGateway = new DVoteGateway({
                uri: gatewayOrParams.dvoteUri,
                supportedApis: gatewayOrParams.supportedApis,
                publicKey: gatewayOrParams.publicKey
            })
            web3Gateway = new Web3Gateway(gatewayOrParams.web3Uri, null, options)
        }
        const gateway = new Gateway(dvoteGateway, web3Gateway)
        return gateway.connect()
            .then(connected => {
                if (connected) return gateway
                throw new Error("Could not connect to the chosen gateway")
            }).catch(error => {
                throw new Error("Could not connect to the chosen gateway: " + error)
            })
    }

    /**
     * Tries to connect both web3 and dvote gateways and returns true only if succeeds at both.
     * @param requiredApis Possible required Dvote APIs
     */
    public connect(requiredApis: DVoteSupportedApi[] = []): Promise<boolean> {
        // console.time("connect web3")
        return this.connectWeb3()
            .then(web3connected => {
                // console.timeEnd("connect web3")
                // console.time("connect dvote")
                if (!web3connected) return false
                return this.connectDvote(requiredApis)
                    .then(dvoteConnected => {
                        // console.timeEnd("connect dvote")
                        if (!dvoteConnected) return false
                        return true

                    })
            })
    }
    public isConnected(): Promise<boolean> {
        // If web3 is connected
        if (this.web3.entityResolverContractAddress && this.web3.processContractAddress)
            // Check dvote connection
            return this.dvote.isConnected()
        else
            return Promise.resolve(false)
    }

    // DVOTE

    async connectDvote(requiredApis: DVoteSupportedApi[] = []): Promise<boolean> {
        if (await this.dvote.isConnected()) return Promise.resolve(true)
        return this.dvote.connect()
            .then(() => this.dvote.getGatewayInfo())
            .then(info => {
                if (!info || !info.api) return false
                else if (!requiredApis.length) return true
                else if (requiredApis.length && requiredApis.every(api => info.api.includes(api)))
                    return true
                return false
            }).catch(error => {
                throw new Error(error)
            })
    }

    public disconnect() {
        return this.dvote.disconnect()
    }

    public getDVoteUri(): Promise<string> {
        return this.dvote.getUri()
    }

    public getChainId(): Promise<number> {
        return this.getProvider().getNetwork().then(network => network.chainId)
    }

    public sendRequest(requestBody: IDvoteRequestParameters, wallet: Wallet | Signer = null, timeout: number = 50): Promise<any> {
        return this.dvote.sendRequest(requestBody, wallet, timeout)
    }

    public getGatewayInfo(timeout: number = 5): Promise<{ api: DVoteSupportedApi[], health: number }> {
        return this.dvote.getGatewayInfo(timeout)
    }

    // WEB3
    public connectWeb3(): Promise<boolean> {
        return this.web3.isUp()
            .then(() => true)
            .catch(() => false)
    }

    public getProvider(): providers.BaseProvider { return this.web3.getProvider() }

    public deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {

        return this.web3.deploy<CustomContractMethods>(abi, bytecode, signParams, deployArguments)
    }

    public getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer): IEnsPublicResolverContract {
        if (!this.web3.entityResolverContractAddress) throw new Error("The gateway is not yet connected")

        if (walletOrSigner && (walletOrSigner instanceof Wallet || walletOrSigner instanceof Signer))
            return this.web3.attach<IEnsPublicResolverContract>(this.web3.entityResolverContractAddress, EntityContractDefinition.abi as any).connect(walletOrSigner) as (IEnsPublicResolverContract)
        return this.web3.attach<IEnsPublicResolverContract>(this.web3.entityResolverContractAddress, EntityContractDefinition.abi as any)
    }

    public getProcessInstance(walletOrSigner?: Wallet | Signer): IProcessContract {
        if (!this.web3.processContractAddress) throw new Error("The gateway is not yet connected")

        if (walletOrSigner && (walletOrSigner instanceof Wallet || walletOrSigner instanceof Signer))
            return this.web3.attach<IProcessContract>(this.web3.processContractAddress, ProcessContractDefinition.abi as any).connect(walletOrSigner) as (IProcessContract)
        return this.web3.attach<IProcessContract>(this.web3.processContractAddress, ProcessContractDefinition.abi as any)
    }

    public async getNamespaceInstance(walletOrSigner?: Wallet | Signer): Promise<INamespaceContract> {
        const address = await this.web3.getNamespaceContractAddress()

        if (walletOrSigner && (walletOrSigner instanceof Wallet || walletOrSigner instanceof Signer))
            return this.web3.attach<INamespaceContract>(address, NamespaceContractDefinition.abi as any).connect(walletOrSigner) as (INamespaceContract)
        return this.web3.attach<INamespaceContract>(address, NamespaceContractDefinition.abi as any)
    }
}

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over Web Sockets
 * intended to interact within voting processes
 */
export class DVoteGateway {
    protected uri: string = ""

    protected supportedApis: DVoteSupportedApi[] = []
    protected pubKey: string = ""

    public health: number = 0

    private webSocket: WebSocket = null
    private http: AxiosInstance = null
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
        } else {
            const { uri, supportedApis, publicKey } = gatewayOrParams
            if (!uri) throw new Error("Invalid gateway URI")

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
    public connect(): Promise<void> {
        // Close any previous web socket that might be open
        this.disconnect()

        const url = parseURL(this.uri)
        switch (url.protocol) {
            case "http:":
            case "https:":
                // Keep a promise so that calls to sendMessage coming before the socket is open
                // wait until the promise is resolved
                this.connectionPromise = new Promise((resolve, reject) => {
                    try {
                        // Set up the connection
                        const buildResponse = msg => {
                            // Detect behavior on Browser/NodeJS
                            if (!msg) throw new Error("Invalid response message")

                            if (typeof msg == "string") {
                                this.gotWebSocketMessage(msg)
                            }
                            else if (msg instanceof Buffer || msg instanceof Uint8Array) {
                                let responseBytes = extractUint8ArrayJSONValue(msg, "response")
                                this.gotWebSocketMessage(msg.toString(), responseBytes)
                            }
                            else if (typeof Blob != "undefined" && msg instanceof Blob) {
                                readBlobText(msg)
                                    .then(textData => {
                                        return readBlobArrayBuffer(msg as any)
                                            .then((arrayBufferData) => [textData, arrayBufferData])
                                    }).then(([textData, arrayBufferData]: [string, ArrayBuffer]) => {
                                        let responseBytes = extractUint8ArrayJSONValue(new Uint8Array(arrayBufferData), "response")
                                        this.gotWebSocketMessage(textData, responseBytes)
                                    })
                            }
                            else {
                                console.error("Unsupported response", typeof msg, msg)
                            }
                        }
                        const httpCon = axios.create({
                            baseURL: this.uri,
                            method: "post",
                            transformResponse: buildResponse,
                        })
                        this.http = httpCon
                        this.connectionPromise = null
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                })
                break
            case "ws:":
            case "wss:":
                // wait until the promise is resolved
                this.connectionPromise = new Promise((resolve, reject) => {
                    // Set up the web socket
                    const ws = new WebSocket(this.uri)
                    ws.onopen = () => {
                        // the socket is ready
                        this.webSocket = ws

                        this.connectionPromise = null
                        resolve()
                    }
                    ws.onmessage = msg => {
                        // Detect behavior on Browser/NodeJS
                        if (!msg || !msg.data) throw new Error("Invalid response message")

                        if (typeof msg.data == "string") {
                            this.gotWebSocketMessage(msg.data)
                        }
                        else if (msg.data instanceof Buffer || msg.data instanceof Uint8Array) {
                            let responseBytes = extractUint8ArrayJSONValue(msg.data, "response")
                            this.gotWebSocketMessage(msg.data.toString(), responseBytes)
                        }
                        else if (typeof Blob != "undefined" && msg.data instanceof Blob) {
                            readBlobText(msg.data)
                                .then(textData => {
                                    return readBlobArrayBuffer(msg.data as any)
                                        .then((arrayBufferData) => [textData, arrayBufferData])
                                }).then(([textData, arrayBufferData]: [string, ArrayBuffer]) => {
                                    let responseBytes = extractUint8ArrayJSONValue(new Uint8Array(arrayBufferData), "response")
                                    this.gotWebSocketMessage(textData, responseBytes)
                                })
                        }
                        else {
                            console.error("Unsupported response", typeof msg.data, msg.data)
                        }
                    }
                    ws.onerror = (err) => reject(err)
                    ws.onclose = () => reject(new Error("Connection closed"))
                })
                break
            default:
                throw new Error("Unsupported gateway protocol: " + url.protocol)
        }

        // if the caller of this function awaits this promise,
        // an eventual call in sendRequest will not need to
        return this.connectionPromise
    }

    /** Close the current connection */
    public disconnect() {
        if (!this.webSocket && !this.http) return
        if (this.webSocket && typeof this.webSocket.terminate == "function") this.webSocket.terminate()
        if (this.webSocket && typeof this.webSocket.close == "function") this.webSocket.close()
        this.webSocket = null
        this.http = null
        // this.uri = null  // Why???
    }

    /**
     * Check whether the client is effectively connected to a Gateway
     */
    public async isConnected(): Promise<boolean> {
        if (this.connectionPromise) await this.connectionPromise
        else if (this.http) return true
        else return this.webSocket != null &&
            this.webSocket.readyState === this.webSocket.OPEN &&
            this.uri != null
    }

    /**
     * Get the current URI of the Gateway
     */
    public async getUri(): Promise<string> {
        if (this.connectionPromise) await this.connectionPromise

        return this.uri
    }

    public getSupportedApis() { return this.supportedApis }

    public get publicKey() { return this.pubKey }

    /**
     * Send a WS message to a Vocdoni Gateway and add an entry to track its response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param timeout (optional) Timeout in seconds to wait before failing (default: 50)
     */
    public async sendRequest(requestBody: IDvoteRequestParameters, wallet: Wallet | Signer = null, timeout: number = 50): Promise<any> {
        if (typeof requestBody != "object") return Promise.reject(new Error("The payload should be a javascript object"))
        else if (typeof wallet != "object") return Promise.reject(new Error("The wallet is required"))

        if (!(await this.isConnected())) {
            await this.connect()
        }

        if (!this.http && !this.webSocket) return Promise.reject(new Error("The gateway connection is not yet available"))

        // Check API method availability
        if ((fileApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("file") < 0) ||
            (voteApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("vote") < 0) ||
            (censusApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("census") < 0) ||
            (resultsApiMethods.indexOf(requestBody.method as any) >= 0 && this.supportedApis.indexOf("results") < 0)
        ) return Promise.reject(new Error("The method is not available in the Gateway's supported API's"))

        // Append the current timestamp to the body
        if (typeof requestBody.timestamp == "undefined") {
            requestBody.timestamp = Math.floor(Date.now() / 1000)
        }
        let rand, requestId
        do {
            rand = Math.random().toString(16).split('.')[1]
            requestId = utils.keccak256('0x' + rand).substr(2, 10)
        } while (this.requestList.some(r => r.id === rand))
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
            if (this.http) this.http.post('', JSON.stringify(sortObjectFields(content)))
            else this.webSocket.send(JSON.stringify(sortObjectFields(content)))
        })

        const msg = (await reqPromise) as GatewayResponse

        if (!msg.response) return Promise.reject(new Error("Invalid response message"))

        const incomingReqId = msg.response.request || null
        if (incomingReqId !== requestId) {
            return Promise.reject(new Error("The signed request ID does not match the expected one"))
        }

        // Check the signature of the response
        if (this.publicKey) {
            // const timestamp = msg.response.timestamp || null
            //
            // const from = Math.floor(Date.now() / 1000) - SIGNATURE_TIMESTAMP_TOLERANCE
            // const until = Math.floor(Date.now() / 1000) + SIGNATURE_TIMESTAMP_TOLERANCE
            // if (typeof timestamp != "number" || timestamp < from || timestamp > until) {
            //     return Promise.reject(new Error("The response does not provide a valid timestamp"))
            // }
            if (msg.responseBytes) {
                if (!isByteSignatureValid(msg.signature, this.publicKey, msg.responseBytes)) {
                    return Promise.reject(new Error("The signature of the response does not match the expected one"))
                }
            } else if (!isValidSignature(msg.signature, this.publicKey, msg.response)) {
                return Promise.reject(new Error("The signature of the response does not match the expected one"))
            }
        }

        if (!msg.response.ok) {
            if (msg.response.message) return Promise.reject(new Error(msg.response.message))
            else return Promise.reject(new Error("There was an error while handling the request at the gateway"))
        }

        return msg.response
    }

    /**
     * Retrieves the status of the given gateway and returns an object indicating the services it provides.
     * If there is no connection open, the method returns null.
     */
    public async getGatewayInfo(timeout?: number): Promise<{ api: DVoteSupportedApi[], health: number }> {
        if (!this.isConnected()) return null

        try {
            let result
            if (timeout)
                result = await this.sendRequest({ method: "getGatewayInfo" }, null, timeout)
            else
                result = await this.sendRequest({ method: "getGatewayInfo" })

            if (!result.ok) throw new Error("Not OK")
            else if (!Array.isArray(result.apiList)) throw new Error("apiList is not an array")
            else if (typeof result.health !== "number") throw new Error("invalid gateway reply")
            this.health = result.health
            this.supportedApis = result.apiList
            return {
                api: result.apiList,
                health: result.health
            }
        }
        catch (error) {
            let message = "The status of the gateway could not be retrieved"
            message = (error.message) ? message + ": " + error.message : message
            throw new Error(message)
        }
    }

    /**
     * Checks the health of the current Gateway by calling isUp
     * @returns the necessary parameters to create a GatewayInfo object
     */
    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<void> {
        const uri = parseURL(this.uri)

        if (uri.host.length === 0) {
            return Promise.reject(new Error("Invalid Gateway URL"))
        }
        return new Promise((resolve, reject) => {
            // Check ping and then status
            setTimeout(() => reject(new Error("The Dvote Gateway is too slow")), timeout)

            this.checkPing()
                .then((isUp) => {
                    if (isUp !== true) return reject(new Error("No ping reply"))

                    return this.connect()
                        .then(() => this.getGatewayInfo(timeout))
                        .then((response) => {
                            if (response && Array.isArray(response.api)) return resolve()
                            return reject(new Error("Invalid DVote Gateway response"))
                        })
                }).catch((err) => {
                    console.error(err);
                    reject(new Error("The DVote Gateway seems to be down"))
                })
        })
    }

    /**
     * Checks the ping response of the gateway
     * @returns A boolean representing wheter the gateway responded correctly or not
     */
    public async checkPing(): Promise<boolean> {
        const uri = parseURL(this.uri)
        let pingUrl: string = `https://${uri.host}/ping`

        try {
            let response = await axios.get(pingUrl).catch(err => {
                return null
            })
            if (response != null &&
                response.status === 200 &&
                response.data === "pong") {
                return true;
            }

            // HTTP fallback
            pingUrl = `http://${uri.host}/ping`

            response = await axios.get(pingUrl).catch(err => {
                return null
            })
            return (response != null &&
                response.status === 200 &&
                response.data === "pong")
        } catch (err) {
            return false
        }
    }

    // PRIVATE METHODS

    /**
     * Handle incoming WS messages and link them to their original request
     * @param strResponse JSON response contents
     */
    private gotWebSocketMessage(strResponse: string, responseBytes?: Uint8Array) {
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
        if (responseBytes && responseBytes.length > 0) {
            response['responseBytes'] = responseBytes
        }
        // The request payload is handled in `sendRequest`
        request.resolve(response)
        delete request.resolve
    }
}

/**
 * A Web3 wrapped client with utility methods to deploy and attach to Ethereum contracts.
 */
export class Web3Gateway {
    private provider: providers.BaseProvider
    public entityResolverContractAddress: string
    public namespaceContractAddress: string
    public processContractAddress: string

    /** Returns a JSON RPC provider that can be used for Ethereum communication */
    public static providerFromUri(uri: string, networkId?: NetworkID, options: { testing: boolean } = { testing: false }) {
        return providerFromUri(uri, networkId, options)
    }

    /**
     * Returns a wrapped Ethereum Web3 client.
     * @param gatewayOrProvider Can be a string with the host's URI or an Ethers Provider
     */
    constructor(gatewayOrProvider: string | GatewayInfo | providers.BaseProvider, networkId?: NetworkID, options: { testing: boolean } = { testing: false }) {
        if (!gatewayOrProvider) throw new Error("Invalid Gateway or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this.provider = Web3Gateway.providerFromUri(gatewayOrProvider, networkId, options)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this.provider = Web3Gateway.providerFromUri(gatewayOrProvider.web3, networkId, options)
        }
        else if (gatewayOrProvider instanceof providers.BaseProvider) { // use as a provider
            this.provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
    }

    /**
     * Deploy the contract using the given signer or wallet.
     * If a signer is given, its current connection will be used.
     * If a wallet is given, the Gateway URI will be used unless the wallet is already connected
     */
    async deploy<CustomContractMethods>(abi: ContractInterface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments?: any[]): Promise<(Contract & CustomContractMethods)> {
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
        return (await contractFactory.deploy(...deployArguments)) as (Contract & CustomContractMethods)
    }

    /**
     * Use the contract instance at the given address using the Gateway as a provider
     * @param address Contract instance address
     * @return A contract instance attached to the given address
     */
    attach<CustomContractMethods>(address: string, abi: ContractInterface): (Contract & CustomContractMethods) {
        if (typeof address != "string") throw new Error("Invalid contract address")
        else if (!abi) throw new Error("Invalid contract ABI")

        return new Contract(address, abi, this.provider) as (Contract & CustomContractMethods)
    }

    /** Returns a JSON RPC provider associated to the initial Gateway URI */
    public getProvider() {
        return this.provider
    }

    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<void> {
        // if (this.entityResolverContractAddress && this.processContractAddress) return Promise.resolve()

        return new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("The Web3 Gateway is too slow")), timeout)

            return this.getPeers()
                .then(peersNumber => {
                    if (peersNumber <= 0) throw new Error("The Web3 gateway has no peers")
                    return this.isSyncing()
                })
                .then(syncing => {
                    if (syncing) throw new Error("The Web3 gateway is syncing")

                    // Fetch and set the contract addresses
                    return Promise.all([
                        this.fetchEntityResolverContractAddress(),
                        this.fetchProcessContractAddress().then(() => this.getNamespaceContractAddress()),
                    ])
                })
                .then(() => resolve())
                .catch(err => {
                    console.error(err)
                    if (err.message == "The Web3 gateway is syncing")
                        reject(new Error(err.message))
                    else
                        reject(new Error("The Web3 Gateway seems to be down"))
                })
        })
    }

    /** Determines whether the current Web3 provider is syncing blocks or not. Several types of prviders may always return false. */
    public isSyncing(): Promise<boolean> {
        if (!this.provider) return Promise.resolve(false)
        else if (this.provider instanceof JsonRpcProvider || this.provider instanceof Web3Provider || this.provider instanceof IpcProvider || this.provider instanceof InfuraProvider) {
            return this.provider.send("eth_syncing", []).then(result => !!result)
        }
        // else if (this.provider instanceof FallbackProvider || this.provider instanceof EtherscanProvider) {}

        return Promise.resolve(false)
    }

    /** Request the amount of peers the Gateway is currently connected to */
    public getPeers(): Promise<number> {
        if (!this.provider) return Promise.resolve(0)
        else if (!(this.provider instanceof JsonRpcProvider) && !(this.provider instanceof Web3Provider) &&
            !(this.provider instanceof IpcProvider) && !(this.provider instanceof InfuraProvider)) {
            return Promise.resolve(0)
        }

        return this.provider.send("net_peerCount", []).then(result => {
            if (!result) return -1
            return utils.bigNumberify(result).toNumber()
        })
    }

    /** Fetches the address of the entity resolver contract and returns it */
    public async fetchEntityResolverContractAddress(): Promise<string> {
        // Used by `isUp` => we fetch it always in order to check that connectivity is up
        this.entityResolverContractAddress = await this.provider.resolveName(entityResolverEnsDomain)

        if (!this.entityResolverContractAddress) throw new Error("The entity resolver name is not available")

        return this.entityResolverContractAddress
    }

    /** Fetches the address of the process contract and returns it */
    public async fetchProcessContractAddress(): Promise<string> {
        // Used by `isUp` => we fetch it always in order to check that connectivity is up
        this.processContractAddress = await this.provider.resolveName(processEnsDomain)

        if (!this.processContractAddress) throw new Error("The process domain name is not available")

        return this.processContractAddress
    }

    /** Returns the address of the namespace contract and fetches it if not present */
    public async getNamespaceContractAddress(): Promise<string> {
        if (!this.processContractAddress) {
            await this.fetchProcessContractAddress()
        }

        if (!this.namespaceContractAddress) {
            // Get it from the process contract
            const processInstance = this.attach<IProcessContract>(this.processContractAddress, ProcessContractDefinition.abi)
            this.namespaceContractAddress = await processInstance.namespaceAddress()

            if (!this.namespaceContractAddress) throw new Error("The process contract didn't return a namespace address")
        }

        return this.namespaceContractAddress
    }
}
