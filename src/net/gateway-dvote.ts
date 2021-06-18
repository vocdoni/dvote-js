import { Wallet, Signer } from "ethers"
import { performance } from "perf_hooks";
import { GatewayInfo } from "../wrappers/gateway-info"
import { GatewayApiMethod, BackendApiMethod, allApis, registryApiMethods, ApiMethod, GatewayApiName, BackendApiName, InfoApiMethod, RawApiMethod } from "../models/gateway"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { JsonSignature, BytesSignature } from "../util/data-signing"
import axios, { AxiosInstance, AxiosResponse } from "axios"
import { extractUint8ArrayJSONValue } from "../util/uint8array"
import { promiseWithTimeout } from '../util/timeout'
import { Random } from '../util/random'

///////////////////////////////////////////////////////////////////////////////
// DVOTE GATEWAY
///////////////////////////////////////////////////////////////////////////////

// Export the class typings as an interface
export type IDVoteGateway = InstanceType<typeof DVoteGateway>

/** Parameters sent by the function caller */
export interface IRequestParameters {
    // Common
    method: ApiMethod,
    timestamp?: number,

    [k: string]: any
}

/** What is actually sent by sendRequest() to the Gateway */
type MessageRequestContent = {
    id: string,
    request: IRequestParameters,
    signature?: string
}

export type DVoteGatewayResponseBody = {
    ok: boolean,
    request: string,
    message?: string,
    timestamp?: number,
    signature?: string,

    // the rest of fields
    [k: string]: any
}

/**
 * This class provides access to Vocdoni Gateways sending JSON payloads over HTTP requests
 * intended to interact within voting processes
 */
export class DVoteGateway {
    private _supportedApis: (GatewayApiName | BackendApiName)[] = []
    private _pubKey: string = ""
    private _health: number = 0
    private _uri: string
    private _performanceTime: number
    private client: AxiosInstance = null
    private _currentRequestId: string

    /**
     * Returns a new DVote Gateway web socket client
     * @param gatewayOrParams Either a GatewayInfo instance or a JSON object with the service URI, the supported API's and the public key
     */
    constructor(gatewayOrParams: GatewayInfo | { uri: string, supportedApis?: (GatewayApiName | BackendApiName)[], publicKey?: string }) {
        if (gatewayOrParams instanceof GatewayInfo) {
            this.client = axios.create({ baseURL: gatewayOrParams.dvote, method: "post", responseType: "arraybuffer" })
            this._uri = gatewayOrParams.dvote
            this._supportedApis = gatewayOrParams.supportedApis || []
            this._pubKey = gatewayOrParams.publicKey
        } else {
            const { uri, supportedApis, publicKey } = gatewayOrParams
            if (!uri) throw new Error("Invalid gateway URI")

            this.client = axios.create({ baseURL: uri, method: "post", responseType: "arraybuffer" })
            this._uri = uri
            this._supportedApis = supportedApis || []
            this._pubKey = publicKey || ""
        }
    }

    /** Checks the gateway status and updates the currently available API's. Same as calling `isUp()` */
    public init(requiredApis: (GatewayApiName | BackendApiName)[] = []): Promise<void> {
        if (this.isReady && requiredApis.every((v) => this.supportedApis.includes(v))) {
            return Promise.resolve()
        } else {
            return this.isUp().then(() => {
                if (!this.supportedApis) return
                else if (!requiredApis.length) return
                const missingApi = requiredApis.find(api => !this.supportedApis.includes(api))

                if (missingApi) throw new Error("A required API is not available: " + missingApi)
            })
        }
    }

    /**
     * Check whether the client is already connected to a Gateway
     *
     * @return boolean
     */
    public get isReady(): boolean {
        return this.isPrepared && Number.isInteger(this.performanceTime)
    }

    /**
     * Check whether the client is prepared to connect to a Gateway
     *
     * @return boolean
     */
    public get isPrepared(): boolean {
        // TODO maybe remove? this should be true when GW is instantiated
        return this.client && this._uri && Array.isArray(this.supportedApis)
    }

    /** Get the current URI of the Gateway */
    public get uri() { return this._uri || null }
    public get supportedApis() { return this._supportedApis }
    public get publicKey() { return this._pubKey }
    public get health() { return this._health }
    // TODO Remove
    public get weight() { return this._health }
    public get performanceTime() { return this._performanceTime }

    /**
     * Send a message to a Vocdoni Gateway and return the checked response
     *
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param params (optional) Optional parameters. Timeout in milliseconds.
     */
    public sendRequest(requestBody: IRequestParameters, wallet: Wallet | Signer = null, params: { timeout?: number } = { timeout: 15 * 1000 }): Promise<DVoteGatewayResponseBody> {
        return this.createRequest(requestBody, wallet)
            .then((request: MessageRequestContent) => {
                return promiseWithTimeout(
                    this.client.post('', JsonSignature.sort(request)),
                    params.timeout,
                )
            })
            .then((response: AxiosResponse) => {
                return this.checkRequest(response)
            })
            .finally(() => {
                this._currentRequestId = null
            })
    }

    /**
     * Create a request for a Vocdoni Gateway, check for a valid body, add control parameters
     * and sign the request if needed
     *
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet The wallet to use for signing (default: null)
     *
     * @return The valid request for a Vocdoni Gateway
     */
    private createRequest(requestBody: IRequestParameters, wallet: Wallet | Signer): Promise<MessageRequestContent> {
        // TODO errors
        if (!this.isPrepared) {
            throw new Error("Not initialized")
        } else if (typeof requestBody !== "object") {
            throw new Error("The payload should be a javascript object")
        } else if (typeof wallet !== "object") {
            throw new Error("The wallet is required")
        }

        // Check API method availability
        if (!this.supportsMethod(requestBody.method)) {
            throw new Error(`The method is not available in the Gateway's supported API's (${requestBody.method})`)
        }

        // Append the current timestamp to the body
        if (typeof requestBody.timestamp === "undefined") {
            requestBody.timestamp = Math.floor(Date.now() / 1000)
        }

        this._currentRequestId = Random.getHex().substr(2, 10)

        const request: MessageRequestContent = {
            id: this._currentRequestId,
            request: requestBody,
            signature: "",
        }

        if (wallet) {
            return JsonSignature.sign(requestBody, wallet)
                .then((signature: string) => {
                    request.signature = signature
                    return request
                })
        }

        return Promise.resolve(request)
    }

    /**
     * Check the result of a Gateway request and return its response
     *
     * @param response
     *
     * @return The checked response of the Gateway
     */
    private checkRequest(response: AxiosResponse): DVoteGatewayResponseBody {
        const msgBytes: Uint8Array = extractUint8ArrayJSONValue(new Uint8Array(response.data), "response")
        const msg: DVoteGatewayResponseBody = JSON.parse(new TextDecoder().decode(response.data))

        if (!msg.response) {
            throw new Error("Invalid response message")
        }

        const incomingReqId = msg.response.request || null
        if (incomingReqId !== this._currentRequestId) {
            throw new Error("The signed request ID does not match the expected one")
        }

        // Check the signature of the response
        if (this.publicKey) {
            if (!BytesSignature.isValid(msg.signature, this.publicKey, msgBytes)) {
                throw new Error("The signature of the response does not match the expected one")
            }
        }

        if (!msg.response.ok) {
            if (msg.response.message) {
                throw new Error(msg.response.message)
            } else {
                throw new Error("There was an error while handling the request at the gateway")
            }
        }

        return msg.response
    }

    /**
     * Alias of updateGatewayStatus, for convenience purposes.
     */
    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<void> {
        return this.updateGatewayStatus(timeout)
    }

    /** Retrieves the status of the gateway and updates the internal status */
    public updateGatewayStatus(timeout?: number): Promise<void> {
        const performanceTime = performance.now()
        return this.getInfo(timeout)
            .then((result) => {
                this._health = result.health
                this._performanceTime = Math.round(performance.now() - performanceTime)
                this._supportedApis = result.apiList
            })
    }

    /**
     * Retrieves the status of the given gateway and returns an object indicating the services it provides.
     * If there is no connection open, the method returns null.
     */
    public getInfo(timeout?: number): Promise<{ apiList: Array<GatewayApiName | BackendApiName>, health: number }> {
        if (!this.isPrepared) {
            return Promise.reject()
        }

        return this.sendRequest({ method: "getInfo" }, null, { timeout })
            .then((result: DVoteGatewayResponseBody) => {
                if (!Array.isArray(result.apiList)) {
                    throw new Error("apiList is not an array")
                } else if (typeof result.health !== "number") {
                    throw new Error("invalid gateway reply")
                }

                return { apiList: result.apiList, health: result.health }
            })
            .catch((error) => {
                // TODO refactor errors
                if (error && error.message == "Time out") return Promise.reject(error.message)
                let message = "The status of the gateway could not be retrieved"
                message = (error.message) ? message + ": " + error.message : message
                return Promise.reject(message)
            })
    }

    /**
     * Determines whether the current DVote Gateway supports the API set that includes the given method.
     * NOTE: `updateStatus()` must have been called on the GW instnace previously.
     */
    public supportsMethod(method: ApiMethod): boolean {
        if (allApis.info.includes(method as InfoApiMethod)) return true
        else if (allApis.raw.includes(method as RawApiMethod)) return true

        for (const api of this.supportedApis) {
            if (api in allApis && allApis[api].includes(method as GatewayApiMethod | BackendApiMethod)) {
                return true
            }
        }
        return false
    }
}
