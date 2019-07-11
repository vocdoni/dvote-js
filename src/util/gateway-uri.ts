export default class GatewayURI {
    private dvoteGatewayUri: string
    private web3GatewayUri: string

    public get dvote() { return this.dvoteGatewayUri }
    public get web3() { return this.web3GatewayUri }

    /** Parses the given string into a Content URI */
    constructor(dvoteGatewayUri: string, web3GatewayUri: string) {
        if (!dvoteGatewayUri || !web3GatewayUri) throw new Error("Both DVote and Web3 URI's are required")
        this.dvoteGatewayUri = dvoteGatewayUri
        this.web3GatewayUri = web3GatewayUri
    }
}
