import { Wallet, Signer } from "ethers"
import { CensusGateway } from "../net/gateway"


export async function addCensus(censusId: string, pubKeys: string[], censusServiceUri: string, walletOrSigner: Wallet | Signer, gatewayUri: string, gatewayPublicKey?: string) {
    if (!censusId || !pubKeys || !pubKeys.length || !censusServiceUri) throw new Error("Invalid parameters")

    const gw = new CensusGateway(gatewayUri, gatewayPublicKey)
    const response = await gw.sendMessage({ method: "addCensus", censusId, pubKeys }, walletOrSigner)
    gw.disconnect()

    return response
}

export function addClaim() {
    throw new Error("TODO: Unimplemented")
}
