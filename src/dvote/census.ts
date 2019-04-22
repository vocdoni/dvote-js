// import { providers, utils } from "ethers"
import Gateway from "./gateway"

export default class Census {
	gateway: Gateway = null
	censusServiceAddress: string = null

	// METHODS

	/**
	 * Creates a contract factory to deploy or attach to VotingProcess instances
	 * @param params 
	 */
	constructor(gatewayWsUri: string, censusServiceAddress: string) {
		this.gateway = new Gateway(gatewayWsUri)
		this.censusServiceAddress = censusServiceAddress

		throw new Error("unimplemented")
	}

	public async addClaim(processId: string, gatewayUri: string, nullifier: string): Promise<boolean> {
		if (!this.censusServiceAddress) throw new Error("The census service address is empty")

		// Ensure we are connected to the right Gateway
		if (!this.gateway) this.gateway = new Gateway(gatewayUri)
		else if (this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

		throw new Error("unimplemented")

		// return this.gateway.request({
		// 	// method: "addClaim",
		// }).then(strData => JSON.parse(strData))
	}
}
