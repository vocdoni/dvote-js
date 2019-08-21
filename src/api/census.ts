import { Wallet, Signer } from "ethers"
import { DVoteGateway } from "../net/gateway"
import GatewayInfo from "../wrappers/gateway-info"

export function addCensus(censusId: string, pubKeys: string[], gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<any> {
    if (!censusId || !pubKeys || !pubKeys.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addCensus", censusId, pubKeys }, walletOrSigner)
}

export function addClaim() {
    throw new Error("TODO: Unimplemented")
}

export function addClaimBulk() {
    throw new Error("TODO: Unimplemented")
}

export function getRoot() {
    throw new Error("TODO: Unimplemented")
}

/**
 * Fetch the proof of the given index on the process census using the given gateway
 * @param processId 
 * @param keyPath
 * @param gateway 
 */
export async function generateProof(processId: string, keyPath: string, gateway: GatewayInfo): Promise<string> {
    // const metadata = await getVoteMetadata(processId, gateway.web3)

    // TODO: Use the CensusService Object

    // TODO: Check that the vote type == ZK Snarks
    // TODO:

    throw new Error("TODO: unimplemented")
}

export function checkProof() {
    throw new Error("TODO: Unimplemented")
}

export function dump() {
    throw new Error("TODO: Unimplemented")
}

export function dumpPlain() {
    throw new Error("TODO: Unimplemented")
}

export function importDump() {
    throw new Error("TODO: Unimplemented")
}
