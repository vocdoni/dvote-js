export default class GatewayURI {
    private dvoteGatewayUri: string
    private censusGatewayUri: string
    private web3GatewayUri: string

    public get dvote() { return this.dvoteGatewayUri }
    public get census() { return this.censusGatewayUri }
    public get web3() { return this.web3GatewayUri }

    /** Parses the given string into a Content URI */
    constructor(dvoteGatewayUri: string, censusGatewayUri: string, web3GatewayUri: string) {
        if (!dvoteGatewayUri || !censusGatewayUri || !web3GatewayUri) {
            throw new Error("DVote, Census and Web3 URI's are required")
        }
        this.dvoteGatewayUri = dvoteGatewayUri
        this.censusGatewayUri = censusGatewayUri
        this.web3GatewayUri = web3GatewayUri
    }
}
