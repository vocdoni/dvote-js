import { Wallet, Signer } from "ethers"
import { DVoteGateway } from "../net/gateway"


export function addCensus(censusId: string, pubKeys: string[], gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<any> {
    if (!censusId || !pubKeys || !pubKeys.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addCensus", censusId, pubKeys }, walletOrSigner)
}

export function addClaim() {
    throw new Error("TODO: Unimplemented")
}
