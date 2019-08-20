import { DVoteSupportedApi } from "../models/gateway-bootnode"

export default class GatewayInfo {
    private dvoteGatewayUri: string
    private supportedApiList: DVoteSupportedApi[]
    private web3GatewayUri: string
    private pubKey: string

    public get dvote() { return this.dvoteGatewayUri }
    public get supportedApis() { return this.supportedApiList }
    public get web3() { return this.web3GatewayUri }
    public get publicKey() { return this.pubKey }

    /** Parses the given string into a Content URI */
    constructor(dvoteGatewayUri: string, supportedApis: DVoteSupportedApi[], web3GatewayUri: string, pubKey: string = "") {
        if (!dvoteGatewayUri || !supportedApis || !web3GatewayUri) {
            throw new Error("DVote URI, Web3 URI and supported API's are required")
        }

        this.dvoteGatewayUri = dvoteGatewayUri
        this.supportedApiList = supportedApis
        this.web3GatewayUri = web3GatewayUri
        this.pubKey = pubKey
    }
}
