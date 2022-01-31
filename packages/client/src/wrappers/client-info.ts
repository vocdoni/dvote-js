import { VocdoniEnvironment } from "@vocdoni/common"
import { BackendApiName, GatewayApiName } from "../apis/definition"

export class ClientInfo {
    private _dvoteUri: string
    private _supportedApiList: GatewayApiName[] | BackendApiName[]
    private _web3Uri: string
    private _pubKey: string
    private _environment: VocdoniEnvironment

    public get dvote() { return this._dvoteUri }
    public get supportedApis() { return this._supportedApiList }
    public get web3() { return this._web3Uri }
    public get publicKey() { return this._pubKey }
    public get environment() { return this._environment }

    /** Bundles the given coordinates into an object containing the details of a Gateway */
    constructor(dvoteUri: string = null, supportedApis: GatewayApiName[] | BackendApiName[] = [], web3Uri: string, pubKey?: string, environment?: VocdoniEnvironment) {
        if (!dvoteUri && !web3Uri) throw new Error("DVote URI or Web3 URI is required")

        if (dvoteUri) {
            if (typeof dvoteUri != "string") throw new Error("Invalid Gateway URI")
            else if (!Array.isArray(supportedApis) || !supportedApis.length) throw new Error("Supported API's should have at least one API")
        }
        if (web3Uri) {
            if (typeof web3Uri != "string") throw new Error("Invalid Web3 URI")
        }

        this._dvoteUri = dvoteUri || null
        this._supportedApiList = supportedApis || []
        this._web3Uri = web3Uri || null
        this._pubKey = pubKey || ""
        this._environment = environment || "prod"
    }
}
