import { ICsp, ICspResponseBody, ICspRequestParameters } from "./interfaces"
import { promiseWithTimeout } from "@vocdoni/common"

import { parseURL } from 'universal-parse-url'
import axios, { AxiosInstance, AxiosResponse } from "axios"

export class CSP implements ICsp {
    private _uri: string
    private _apiVersion: string
    private client: AxiosInstance = null
    private _pubKey: string = ""
    private _hasTimeOutLastRequest: boolean
    private _timeout: number

    /**
    * Returns a new CSP client
    * @param uri The CSP service URI
    * @param publicKey The CSP public key
    * @param timeout timeout in seconds
    */
    constructor(uri: string, publicKey: string, apiVersion?:string ,timeout?: number) {
        if ((!uri) || (!publicKey)) throw new Error("Invalid gateway info")
        this._apiVersion = apiVersion || "v1"
        const parsedUri = parseURL(uri)
        this._uri = `${parsedUri.protocol}//${parsedUri.host}/${this._apiVersion}`
        this._pubKey = publicKey
        this.client = axios.create({ baseURL: uri, responseType: "json"})
        this._timeout = timeout * 1000 || 3 * 1000
    }

    /** Checks the CSP status  */
    public init(): Promise<void> {
        if (!this.client) return Promise.reject(new Error("The client is not initialized"))
        const uri = parseURL(this._uri)

        if (uri.host.length === 0) {
            return Promise.reject(new Error("Invalid Gateway URL"))
        }
        return promiseWithTimeout(
            this.checkPing()
                .then((isUp) => {
                    console.log("isUP Success")
                    if (isUp !== true) throw new Error("No ping reply")
                }),
            this._timeout,
            "The DVote Gateway seems to be down")
    }


    public get uri() { return this._uri || null }
    public get publicKey() { return this._pubKey }

    /**
     * Send a message to a Vocdoni Gateway and return the checked response
     *
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param params (optional) Optional parameters. Timeout in milliseconds.
     */
    public sendRequest(uriPath: string, requestBody: ICspRequestParameters, params: { timeout?: number } = { timeout: this._timeout }): Promise<ICspResponseBody> {
        if (typeof requestBody !== "object") {
            throw new Error("The payload should be a javascript object")
        }
        this._hasTimeOutLastRequest = false

        // TODO: MArc you will love the next line
        const request = (Object.keys(requestBody).length) ? this.client.post(this._uri+uriPath, requestBody) : this.client.get(this._uri+uriPath)

        return promiseWithTimeout(
            request,
            params.timeout || this._timeout,
        )
            .then((response: AxiosResponse) => {
                console.log(response);
                return this.checkResponse(response)
            })
            .catch((error) => {
                console.log("Recibido en client/csp", JSON.stringify(error, null, 2))
                // TODO refactor errors
                if (error && error.message == "Time out") {
                    this._hasTimeOutLastRequest = true
                }
                if (error.reponse) return Promise.reject(new Error(error.response))
                return Promise.reject(error)
            })
    }

    /**
     * Check the response of a Gateway and return its content
     *
     * @param response The response from the Gateway
     * @param requestId The request id set in the request
     *
     * @return The checked response of the Gateway
     */
    private checkResponse(response: AxiosResponse): ICspResponseBody {
        console.log("Recibido en client/csp/checkResponse", JSON.stringify(response, null, 2))
        const responseBody: ICspResponseBody = response.data
        if (response.status != 200 || responseBody.error != null) {
            throw new Error(responseBody.error || "")
        }

        const { error } = responseBody
        if (error) throw new Error(error)

        return responseBody
    }

    /**
     * Checks the ping response of the gateway
     * @returns A boolean representing wheter the gateway responded correctly or not
     */
    public checkPing(): Promise<boolean> {
        if (!this.client) return Promise.reject(new Error("The client is not initialized"))
        const uri = parseURL(this._uri)
        const pingUrl = `${uri.protocol}//${uri.host}/ping`

        return promiseWithTimeout(axios.get(pingUrl), this._timeout)
            .then((response?: AxiosResponse<any>) => (
                response != null && response.status === 200
            ))
    }
}
