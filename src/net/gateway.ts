// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { parseURL } from 'universal-parse-url'
import { Buffer } from 'buffer/'
import { Contract, ContractFactory, providers, utils, Wallet, Signer, ContractInterface, BigNumber } from "ethers"
import { ProviderUtil } from "../util/providers"
import GatewayInfo from "../wrappers/gateway-info"
import { DVoteSupportedApi, DVoteGatewayMethod, fileApiMethods, voteApiMethods, censusApiMethods, dvoteGatewayApiMethods, resultsApiMethods, dvoteApis } from "../models/gateway"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { JsonSignature, BytesSignature } from "../util/data-signing"
import axios, { AxiosInstance, AxiosResponse } from "axios"
import { GatewayBootnode, EthNetworkID } from "./gateway-bootnode"
import ContentURI from "../wrappers/content-uri"
import { extractUint8ArrayJSONValue } from "../util/uint8array"
import { readBlobText, readBlobArrayBuffer } from "../util/blob"
import { IProcessContract, IEnsPublicResolverContract, INamespaceContract, ITokenStorageProofContract } from "../net/contracts"
import {
    PublicResolverContractDefinition,
    ProcessesContractDefinition,
    NamespacesContractDefinition,
    TokenStorageProofContractDefinition,
    EnsPublicResolverContractMethods,
    ProcessContractMethods,
    NamespaceContractMethods,
    TokenStorageProofContractMethods
} from "./contracts"
import { publicResolverEnsDomain, processesEnsDomain, namespacesEnsDomain, storageProofsEnsDomain } from "../constants"
import { promiseFuncWithTimeout, promiseWithTimeout } from '../util/timeout'
import { Random } from '../util/random'

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
    method: DVoteGatewayMethod,
    timestamp?: number,

    [k: string]: any
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

        // the rest of fields
        [k: string]: any
    },
    signature?: string,
    // responseBytes?: Uint8Array,
}

/**
 * This is class, addressed to the end user, is a wrapper of DvoteGateway and Web3Gateway
 */
export class Gateway {
    protected dvote: DVoteGateway = null
    protected web3: Web3Gateway = null
    public get health() { return this.dvote.health }
    public get publicKey() { return this.dvote.publicKey }
    public get supportedApis() { return this.dvote.supportedApis }

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
    static randomFromDefault(networkId: EthNetworkID, requiredApis: DVoteSupportedApi[] = [], options: { testing: boolean } = { testing: false }): Promise<Gateway> {
        return GatewayBootnode.getDefaultGateways(networkId)
            .then(async bootNodeData => {
                const gateways = GatewayBootnode.digestNetwork(bootNodeData, networkId, options)
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
                    connected = await gw.init(requiredApis).catch(() => (false))
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
    static randomfromUri(networkId: EthNetworkID, bootnodesContentUri: string | ContentURI, requiredApis: DVoteSupportedApi[] = [], options: { testing: boolean } = { testing: false }): Promise<Gateway> {
        return GatewayBootnode.getGatewaysFromUri(bootnodesContentUri)
            .then(async bootNodeData => {
                const gateways = GatewayBootnode.digestNetwork(bootNodeData, networkId, options)
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
                    connected = await gw.init(requiredApis).catch(() => (false))
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
        return gateway.init()
            .then(connected => {
                if (connected) return gateway
                throw new Error("Could not connect to the chosen gateway")
            }).catch(error => {
                throw new Error("Could not connect to the chosen gateway: " + error)
            })
    }

    /**
     * Initializes and checks the connection of the DVote and Web3 nodes. Returns true if both are OK.
     * @param requiredApis Expected DVote APIs
     */
    public init(requiredApis: DVoteSupportedApi[] = []): Promise<boolean> {
        return Promise.all([
            this.web3.initEns(),
            this.dvote.init()
        ]).then(() => {
            if (!this.dvote.supportedApis) return false
            else if (!requiredApis.length) return true
            else if (requiredApis.length && requiredApis.every(api => this.dvote.supportedApis.includes(api)))
                return true
            return false
        }).catch(error => {
            throw new Error(error)
        })
    }

    public get isReady(): boolean {
        return this.web3.isReady && this.dvote.isReady
    }

    // DVOTE

    async isDVoteUp(requiredApis: DVoteSupportedApi[] = []): Promise<boolean> {
        return this.dvote.isUp()
            .then(() => {
                if (!this.dvote.supportedApis) return false
                else if (!requiredApis.length) return true
                else if (requiredApis.length && requiredApis.every(api => this.dvote.supportedApis.includes(api)))
                    return true
                return false
            }).catch(error => {
                throw new Error(error)
            })
    }

    public get dvoteUri() { return this.dvote.uri }

    public get chainId(): Promise<number> {
        return this.provider.getNetwork().then(network => network.chainId)
    }

    /**
     * Send a message to a Vocdoni Gateway and return the response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param params (optional) Optional parameters. Timeout in milliseconds.
     */
    public sendRequest(requestBody: IDvoteRequestParameters, wallet: Wallet | Signer = null, params?: { timeout: number }): Promise<any> {
        return this.dvote.sendRequest(requestBody, wallet, params)
    }

    public getGatewayInfo(timeout: number = 2 * 1000): Promise<{ apiList: DVoteSupportedApi[], health: number }> {
        return this.dvote.getGatewayInfo(timeout)
    }

    public supportsMethod(method: DVoteGatewayMethod): boolean {
        return this.dvote.supportsMethod(method)
    }

    // WEB3
    public isWeb3Up(): Promise<boolean> {
        return this.web3.isUp()
            .then(() => true)
            .catch(() => false)
    }

    public get provider(): providers.BaseProvider { return this.web3.provider }

    public deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {

        return this.web3.deploy<CustomContractMethods>(abi, bytecode, signParams, deployArguments)
    }

    /**
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        return this.web3.getEnsPublicResolverInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Process contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessContract> {
        return this.web3.getProcessesInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Namespace contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespaceContract> {
        return this.web3.getNamespacesInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        return this.web3.getTokenStorageProofInstance(walletOrSigner, customAddress)
    }
}

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over Web Sockets
 * intended to interact within voting processes
 */
export class DVoteGateway {
    private _supportedApis: DVoteSupportedApi[] = []
    private _pubKey: string = ""
    private _health: number = 0
    private _uri: string
    private client: AxiosInstance = null

    /**
     * Returns a new DVote Gateway web socket client
     * @param gatewayOrParams Either a GatewayInfo instance or a JSON object with the service URI, the supported API's and the public key
     */
    constructor(gatewayOrParams: GatewayInfo | { uri: string, supportedApis: DVoteSupportedApi[], publicKey?: string }) {
        if (gatewayOrParams instanceof GatewayInfo) {
            this.client = axios.create({ baseURL: gatewayOrParams.dvote, method: "post" })
            this._uri = gatewayOrParams.dvote
            this._supportedApis = gatewayOrParams.supportedApis
            this._pubKey = gatewayOrParams.publicKey
        } else {
            const { uri, supportedApis, publicKey } = gatewayOrParams
            if (!uri) throw new Error("Invalid gateway URI")

            this.client = axios.create({ baseURL: uri, method: "post" })
            this._uri = uri
            this._supportedApis = supportedApis
            this._pubKey = publicKey || ""
        }
    }

    /** Checks the gateway status and updates the currently available API's. Same as calling `isUp()` */
    public init(): Promise<any> {
        return this.isUp().then(() => { })
    }

    /** Check whether the client is connected to a Gateway */
    public get isReady(): boolean {
        return this.client && this._uri && this.supportedApis && this.supportedApis.length > 0
    }

    /** Get the current URI of the Gateway */
    public get uri() { return this._uri || null }
    public get supportedApis() { return this._supportedApis }
    public get publicKey() { return this._pubKey }
    public get health() { return this._health }

    /**
     * Send a message to a Vocdoni Gateway and return the response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param params (optional) Optional parameters. Timeout in milliseconds.
     */
    public async sendRequest(requestBody: IDvoteRequestParameters, wallet: Wallet | Signer = null, params: { timeout?: number } = { timeout: 15 * 1000 }) {
        if (!this.isReady) throw new Error("Not initialized")
        else if (typeof requestBody != "object") throw new Error("The payload should be a javascript object")
        else if (typeof wallet != "object") throw new Error("The wallet is required")

        // Check API method availability
        if (!dvoteGatewayApiMethods.includes(requestBody.method)) throw new Error("The method is not valid")
        else if (!this.supportsMethod(requestBody.method)) throw new Error(`The method is not available in the Gateway's supported API's (${requestBody.method})`)

        // Append the current timestamp to the body
        if (typeof requestBody.timestamp == "undefined") {
            requestBody.timestamp = Math.floor(Date.now() / 1000)
        }
        const requestId = Random.getHex().substr(2, 10)

        const request: MessageRequestContent = {
            id: requestId,
            request: requestBody,
            signature: ""
        }
        if (wallet) {
            request.signature = await JsonSignature.sign(requestBody, wallet)
        }

        const response = await promiseWithTimeout(
            this.client.post('', JsonSignature.sort(request)),
            params.timeout
        )

        let msg: GatewayResponse
        let msgBytes: Uint8Array

        // Detect behavior on Browser/NodeJS
        if (!response.data) throw new Error("Invalid response message")
        else if (typeof response.data == "string") {
            try { msg = JSON.parse(response.data) }
            catch (err) {
                console.error("GW response parsing error:", err)
                throw err
            }
            // this.handleGatewayResponse(response.data)
        }
        else if (response.data instanceof Buffer || response.data instanceof Uint8Array) {
            try { msg = JSON.parse(response.data.toString()) }
            catch (err) {
                console.error("GW response parsing error:", err)
                throw err
            }
            msgBytes = extractUint8ArrayJSONValue(response.data, "response")
            // this.handleGatewayResponse(response.data.toString(), responseBytes)
        }
        else if (typeof Blob != "undefined" && response.data instanceof Blob) {
            const responseData = await readBlobText(response.data)
            try { msg = JSON.parse(responseData) }
            catch (err) {
                console.error("GW response parsing error:", err)
                throw err
            }
            const arrayBufferData = await readBlobArrayBuffer(response.data)
            msgBytes = extractUint8ArrayJSONValue(new Uint8Array(arrayBufferData), "response")

            // readBlobText(response.data)
            //     .then(textData => {
            //         return readBlobArrayBuffer(response.data)
            //             .then((arrayBufferData) => [textData, arrayBufferData])
            //     }).then(([textData, arrayBufferData]: [string, ArrayBuffer]) => {
            //         let responseBytes = extractUint8ArrayJSONValue(new Uint8Array(arrayBufferData), "response")
            //         this.handleGatewayResponse(textData, responseBytes)
            //     })
        }
        else if (typeof response.data == "object") {
            msg = response.data
        }
        else {
            throw new Error("Unsupported response: [" + typeof response.data + "] - " + response.data)
        }

        if (!msg.response) throw new Error("Invalid response message")

        const incomingReqId = msg.response.request || null
        if (incomingReqId !== requestId) {
            throw new Error("The signed request ID does not match the expected one")
        }

        // Check the signature of the response
        if (this.publicKey) {
            // const timestamp = msg.response.timestamp || null
            //
            // const from = Math.floor(Date.now() / 1000) - SIGNATURE_TIMESTAMP_TOLERANCE
            // const until = Math.floor(Date.now() / 1000) + SIGNATURE_TIMESTAMP_TOLERANCE
            // if (typeof timestamp != "number" || timestamp < from || timestamp > until) {
            //     throw new Error("The response does not provide a valid timestamp")
            // }
            if (msgBytes) {
                if (!BytesSignature.isValid(msg.signature, this.publicKey, msgBytes)) {
                    throw new Error("The signature of the response does not match the expected one")
                }
            } else if (!JsonSignature.isValid(msg.signature, this.publicKey, msg.response)) {
                throw new Error("The signature of the response does not match the expected one")
            }
        }

        if (!msg.response.ok) {
            if (msg.response.message) throw new Error(msg.response.message)
            else throw new Error("There was an error while handling the request at the gateway")
        }

        return msg.response
    }

    /**
     * Checks the health of the current Gateway. Resolves the promise when successful and rejects it otherwise.
     */
    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<void> {
        if (!this.client) return Promise.reject(new Error("The client is not initialized"))
        const uri = parseURL(this._uri)

        if (uri.host.length === 0) {
            return Promise.reject(new Error("Invalid Gateway URL"))
        }
        return promiseWithTimeout(
            this.checkPing()
                .then((isUp) => {
                    if (isUp !== true) throw new Error("No ping reply")
                    return this.updateGatewayStatus(timeout)
                }),
            timeout || 2 * 1000,
            "The DVote Gateway seems to be down")
    }

    /** Retrieves the status of the gateway and updates the internal status */
    public updateGatewayStatus(timeout?: number): Promise<any> {
        return this.getGatewayInfo(timeout)
            .then((result) => {
                if (!result) throw new Error("Could not update")
                else if (!Array.isArray(result.apiList)) throw new Error("apiList is not an array")
                else if (typeof result.health !== "number") throw new Error("invalid health")
                this._health = result.health
                this._supportedApis = result.apiList
            })
    }

    /**
     * Retrieves the status of the given gateway and returns an object indicating the services it provides.
     * If there is no connection open, the method returns null.
     */
    public async getGatewayInfo(timeout?: number): Promise<{ apiList: DVoteSupportedApi[], health: number }> {
        if (!this.isReady) return null

        try {
            const result = await promiseWithTimeout(
                this.sendRequest({ method: "getGatewayInfo" }, null),
                timeout || 1000
            )
            if (!Array.isArray(result.apiList)) throw new Error("apiList is not an array")
            else if (typeof result.health !== "number") throw new Error("invalid gateway reply")

            return { apiList: result.apiList, health: result.health }
        }
        catch (error) {
            if (error && error.message == "Time out") throw error
            console.error("FAILED", error)
            let message = "The status of the gateway could not be retrieved"
            message = (error.message) ? message + ": " + error.message : message
            throw new Error(message)
        }
    }

    /**
     * Checks the ping response of the gateway
     * @returns A boolean representing wheter the gateway responded correctly or not
     */
    public checkPing(): Promise<boolean> {
        if (!this.client) return Promise.reject(new Error("The client is not initialized"))
        const uri = parseURL(this._uri)
        const pingUrl = `${uri.protocol}//${uri.host}/ping`

        return promiseWithTimeout(axios.get(pingUrl), 2 * 1000)
            .catch(err => null)
            .then((response?: AxiosResponse<any>) => (
                response != null && response.status === 200 && response.data === "pong"
            ))
    }

    /**
     * Determines whether the current DVote Gateway supports the API set that includes the given method.
     * NOTE: `updateStatus()` must have been called on the GW instnace previously.
     */
    public supportsMethod(method: DVoteGatewayMethod): boolean {
        if (dvoteApis.file.includes(method))
            return this.supportedApis.includes("file")
        else if (dvoteApis.census.includes(method))
            return this.supportedApis.includes("census")
        else if (dvoteApis.vote.includes(method))
            return this.supportedApis.includes("vote")
        else if (dvoteApis.results.includes(method))
            return this.supportedApis.includes("results")
        else if (dvoteApis.info.includes(method)) return true;
        return false;
    }
}

/**
 * A Web3 wrapped client with utility methods to deploy and attach to Ethereum contracts.
 */
export class Web3Gateway {
    private _provider: providers.BaseProvider
    public ensPublicResolverContractAddress: string
    public namespacesContractAddress: string
    public processesContractAddress: string
    public tokenStorageProofContractAddress: string

    /**
     * Returns a wrapped Ethereum Web3 client.
     * @param gatewayOrProvider Can be a string with the host's URI or an Ethers Provider
     */
    constructor(gatewayOrProvider: string | GatewayInfo | providers.BaseProvider, networkId?: EthNetworkID, options: { testing: boolean } = { testing: false }) {
        if (!gatewayOrProvider) throw new Error("Invalid Gateway or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider, networkId, options)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider.web3, networkId, options)
        }
        else if (gatewayOrProvider instanceof providers.BaseProvider) { // use as a provider
            this._provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
    }

    /** Initialize the contract addresses */
    public async initEns() {
        const [addr1, addr2] = await Promise.all([
            this._provider.resolveName(publicResolverEnsDomain),
            this._provider.resolveName(processesEnsDomain)
        ])
        if (!addr1) throw new Error("The resolver address could not be fetched")
        else if (!addr2) throw new Error("The process contract address bould not be fetched")

        this.ensPublicResolverContractAddress = addr1
        this.processesContractAddress = addr2

        // Get namespace and storage proof addresses from the process contract
        const processInstance = this.attach<IProcessContract>(this.processesContractAddress, ProcessesContractDefinition.abi)

        const [addr3, addr4] = await Promise.all([
            processInstance.namespaceAddress(),
            processInstance.tokenStorageProof()
        ])

        if (!addr3) throw new Error("The process contract didn't return a namespace address")
        else if (!addr4) throw new Error("The process contract didn't return a storage proof address")

        this.namespacesContractAddress = addr3
        this.tokenStorageProofContractAddress = addr4
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
                wallet = new Wallet(wallet.privateKey, this._provider)
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

        return new Contract(address, abi, this._provider) as (Contract & CustomContractMethods)
    }

    /** Returns a JSON RPC provider associated to the initial Gateway URI */
    public get provider() {
        return this._provider
    }

    /** Returns true if the provider and contract details are properly set */
    public get isReady(): boolean {
        return !!this._provider &&
            !!this.ensPublicResolverContractAddress &&
            !!this.processesContractAddress &&
            !!this.namespacesContractAddress &&
            !!this.tokenStorageProofContractAddress
    }

    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT, checkEns?: boolean): Promise<any> {
        return promiseFuncWithTimeout(() => {
            return this.getPeers()
                .then(peersNumber => {
                    if (peersNumber <= 0) throw new Error("The Web3 gateway has no peers")
                    return this.isSyncing()
                })
                .then(syncing => {
                    if (syncing) throw new Error("The Web3 gateway is syncing")
                    else if (this.isReady) return // done
                    else if (!checkEns) return // done

                    // Fetch and set the contract addresses
                    return this.initEns()
                })
                .then(() => null)
                .catch(err => {
                    // console.error(err)
                    if (err.message == "The Web3 gateway is syncing")
                        throw new Error(err.message)
                    else
                        throw new Error("The Web3 Gateway seems to be down")
                })
        }, timeout, "The Web3 Gateway is too slow")
    }

    /** Determines whether the current Web3 provider is syncing blocks or not. Several types of prviders may always return false. */
    public isSyncing(): Promise<boolean> {
        if (!this._provider) return Promise.resolve(false)
        else if (this._provider instanceof JsonRpcProvider || this._provider instanceof Web3Provider || this._provider instanceof IpcProvider || this._provider instanceof InfuraProvider) {
            return this._provider.send("eth_syncing", []).then(result => !!result)
        }
        // else if (this._provider instanceof FallbackProvider || this._provider instanceof EtherscanProvider) {}

        return Promise.resolve(false)
    }

    /** Request the amount of peers the Gateway is currently connected to */
    public getPeers(): Promise<number> {
        if (!this._provider) return Promise.resolve(0)
        else if (!(this._provider instanceof JsonRpcProvider) && !(this._provider instanceof Web3Provider) &&
            !(this._provider instanceof IpcProvider) && !(this._provider instanceof InfuraProvider)) {
            return Promise.resolve(0)
        }

        return this._provider.send("net_peerCount", []).then(result => {
            if (!result) return -1
            return BigNumber.from(result).toNumber()
        })
    }

    ///////////////////////////////////////////////////////////////////////////
    // CONTRACT INSTANCE GETTERS
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public async getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        const contractAbi = PublicResolverContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.ensPublicResolverContractAddress
        }

        if (walletOrSigner) {
            return this.attach<EnsPublicResolverContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IEnsPublicResolverContract
        }
        return this.attach<EnsPublicResolverContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Process contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public async getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessContract> {
        const contractAbi = ProcessesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.processesContractAddress
        }

        if (walletOrSigner) {
            return this.attach<ProcessContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IProcessContract
        }
        return this.attach<ProcessContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Namespace contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespaceContract> {
        const contractAbi = NamespacesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.namespacesContractAddress
        }

        if (walletOrSigner) {
            return this.attach<NamespaceContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as INamespaceContract
        }
        return this.attach<NamespaceContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        const contractAbi = TokenStorageProofContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.tokenStorageProofContractAddress
        }

        if (walletOrSigner) {
            return this.attach<TokenStorageProofContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as ITokenStorageProofContract
        }
        return this.attach<TokenStorageProofContractMethods>(contractAddress, contractAbi)
    }
}
