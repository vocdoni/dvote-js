import { Wallet, Signer } from "ethers"
import { DVoteGateway } from "../net/gateway"
import GatewayInfo from "../wrappers/gateway-info"

/**
 * Asks the Gateway to create a new census and use the given public key hashes
 * @param censusId 
 * @param pubKeyHashes SHA3-256 array generated from the users' public keys
 * @param gateway A DVoteGateway instance connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export async function addCensus(censusId: string, pubKeyHashes: string[], gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !pubKeyHashes || !pubKeyHashes.length || !gateway) throw new Error("Invalid parameters")

    // Check if the census already exists
    let existingRoot
    try {
        existingRoot = await getRoot(censusId, gateway)
        if (existingRoot) {
            await addClaimBulk(censusId, pubKeyHashes, gateway, walletOrSigner)
            return getRoot(censusId, gateway)
        }
    } catch (err) { }

    // TODO: rename `pubKeys` into claims (GW also)
    const response = await gateway.sendMessage({ method: "addCensus", censusId, pubKeys: pubKeyHashes }, walletOrSigner)
    if (!response.ok) throw new Error("The census could not be created")

    return getRoot(censusId, gateway)
}

/**
 * Asks the Gateway to add the given public key hashe to a census previously registered on it
 * @param censusId 
 * @param pubKeyHash SHA3-256 array generated from a users' public key
 * @param gateway A DVoteGateway instance already connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export function addClaim(censusId: string, pubKeyHash: string, gateway: DVoteGateway, walletOrSigner: Wallet | Signer) {
    if (!censusId || !pubKeyHash || !pubKeyHash.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addClaim", censusId, claimData: pubKeyHash }, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The claim could not be added")

        return getRoot(censusId, gateway)
    })
}

/**
 * Asks the Gateway to add the given public key hashes to a census previously registered on it
 * @param censusId 
 * @param pubKeyHashes SHA3-256 array generated from the users' public keys
 * @param gateway A DVoteGateway instance already connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export function addClaimBulk(censusId: string, pubKeyHashes: string[], gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !pubKeyHashes || !pubKeyHashes.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addClaimBulk", censusId, claimsData: pubKeyHashes }, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The claims could not be added")

        return getRoot(censusId, gateway)
    })
}

export function getRoot(censusId: string, gateway: DVoteGateway): Promise<string> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "getRoot", censusId }).then(response => {
        if (!response.root) throw new Error("The census merkle root could not be fetched")
        return response.root
    })
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
