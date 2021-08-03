import { VocdoniEnvironment } from "../models/common";
import { BackendApiName, GatewayApiName } from "../models/gateway"

// const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

export class GatewayInfo {
    private dvoteUri: string
    private supportedApiList: GatewayApiName[] | BackendApiName[]
    private web3Uri: string
    private pubKey: string
    private env: VocdoniEnvironment

    public get dvote() { return this.dvoteUri }
    public get supportedApis() { return this.supportedApiList }
    public get web3() { return this.web3Uri }
    public get publicKey() { return this.pubKey }
    public get environment() { return this.env }

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

        this.dvoteUri = dvoteUri || null
        this.supportedApiList = supportedApis || []
        this.web3Uri = web3Uri || null
        this.pubKey = pubKey || ""
        this.env = environment || "prod"
    }
}
