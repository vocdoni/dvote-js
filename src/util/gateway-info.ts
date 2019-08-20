import { DVoteSupportedApi } from "../models/gateway-bootnode"

const uriPattern = /^([a-z][a-z0-9+.-]+):(\/\/([^@]+@)?([a-z0-9.\-_~]+)(:\d+)?)?((?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])*)*|(?:\/(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@])+)*)?(\?(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?(\#(?:[a-z0-9-._~]|%[a-f0-9]|[!$&'()*+,;=:@]|[/?])+)?$/i

export default class GatewayInfo {
    private dvoteUri: string
    private supportedApiList: DVoteSupportedApi[]
    private web3Uri: string
    private pubKey: string

    public get dvote() { return this.dvoteUri }
    public get supportedApis() { return this.supportedApiList }
    public get web3() { return this.web3Uri }
    public get publicKey() { return this.pubKey }

    /** Parses the given string into a Content URI */
    constructor(dvoteUri: string, supportedApis: DVoteSupportedApi[], web3Uri: string, pubKey?: string) {
        if (!dvoteUri || !Array.isArray(supportedApis) || !web3Uri) {
            throw new Error("DVote URI, Web3 URI and supported API's are required")
        }
        else if (!uriPattern.test(dvoteUri)) throw new Error("Invalid Gateway URI")
        else if (!uriPattern.test(web3Uri)) throw new Error("Invalid Web3 URI")

        this.dvoteUri = dvoteUri
        this.supportedApiList = supportedApis
        this.web3Uri = web3Uri
        this.pubKey = pubKey || ""
    }
}
