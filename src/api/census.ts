import { Wallet, Signer } from "ethers"
import { DVoteGateway } from "../net/gateway"
import { sha3_256 } from 'js-sha3'
import ContentURI from "../wrappers/content-uri"
// import GatewayInfo from "../wrappers/gateway-info"

/** 
 * A census ID consists of the Entity Address and the hash of the name.
 * This function returns the full Census ID
 */
export function generateCensusId(censusName: string, entityAddress: string) {
    const prefix = "0x" + entityAddress.toLowerCase().substr(2)
    const suffix = generateCensusIdSuffix(censusName)
    return prefix + "/" + suffix
}

/** 
 * A census ID consists of the Entity Address and the hash of the name.
 * This function computes the second term
 */
export function generateCensusIdSuffix(censusName: string) {
    // A census ID consists of the Entity Address and the hash of the name
    // Now computing the second term
    return "0x" + sha3_256(censusName.toLowerCase().trim())
}

/**
 * Asks the Gateway to create a new census and set the given public key as the ones who can manage it
 * @param censusName Name given to the census. Will be used to generate the census ID by trimming spaces and converting text to lowercase 
 * @param managerPublicKeys ECDSA public key(s) that can manage this census
 * @param gateway A DVoteGateway instance connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export async function addCensus(censusName: string, managerPublicKeys: string[], gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<{ censusId: string, merkleRoot: string }> {
    if (!censusName || !managerPublicKeys || !managerPublicKeys.length || !gateway) throw new Error("Invalid parameters")

    const censusId = generateCensusId(censusName, await walletOrSigner.getAddress())

    // Check if the census already exists
    let existingRoot
    try {
        // TODO: normalize the `censusId` parameter value
        // Pass the full censusId instead of the second term only
        existingRoot = await getRoot(censusId, gateway)
        if (typeof existingRoot == "string" && existingRoot.match(/^0x[0-9a-zA-Z]+$/)) return { censusId, merkleRoot: existingRoot }
    } catch (err) {
        // console.error(err)
        // If it errors because it doesn't exist, we continue below
    }

    const censusIdSuffix = generateCensusIdSuffix(censusName)

    const response = await gateway.sendMessage({ method: "addCensus", censusId: censusIdSuffix, pubKeys: managerPublicKeys }, walletOrSigner)
    if (!response.ok) throw new Error("The census could not be created")

    const merkleRoot = await getRoot(censusId, gateway)

    return { censusId: response.censusId, merkleRoot }
}

/**
 * Asks the Gateway to add the given public key hashe to a census previously registered on it
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
 * @param pubKeyHash SHA3-256 array generated from a users' public key
 * @param gateway A DVoteGateway instance already connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export function addClaim(censusId: string, pubKeyHash: string, gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !pubKeyHash || !pubKeyHash.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addClaim", censusId, claimData: pubKeyHash }, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The claim could not be added")

        return getRoot(censusId, gateway)
    })
}

/**
 * Asks the Gateway to add the given public key hashes to a census previously registered on it
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
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

/**
 * Asks the Gateway to fetch 
 * @param censusId The full Census ID to fetch from the Gateway
 * @param gateway A DVoteGateway instance already connected to a remote Gateway
 * @returns Promise resolving with the merkleRoot
 */
export function getRoot(censusId: string, gateway: DVoteGateway): Promise<string> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "getRoot", censusId }).then(response => {
        if (!response.root) throw new Error("The census merkle root could not be fetched")
        return response.root
    })
}

/** Dumps the entire content of the census as an array of hexStrings rady to be imported to another census service */
export function dump() {
    throw new Error("TODO: Unimplemented")
}

/** Dumps the contents of a census in raw string format. Not valid to use with `importDump` */
export function dumpPlain() {
    throw new Error("TODO: Unimplemented")
}

/** Only works with specific merkletree format used by dump method. To add a list of plain claims use `addClaimBulk` instead */
export function importDump() {
    throw new Error("TODO: Unimplemented")
}

/** Import a previously published remote census. Only valid URIs accepted */
export function importRemote() {
    throw new Error("TODO: Unimplemented")
}

/** Exports and publish the entire census on the storage of the backend (usually IPFS). Returns the URI of the set of claims */
export function publishCensus(censusId: string, gateway: DVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "publish", censusId }, walletOrSigner).then(response => {
        if (!response.uri) throw new Error("The census claim URI could not be retrieved")
        return response.uri
    })
}

/**
 * Fetch the proof of the given claim on the given census merkleTree using the given gateway
 * @param merkleTreeLink A ContentURI with a link to the Merkle Tree data to fetch from
 * @param claim
 * @param gateway 
 */
export async function generateProof(merkleTreeLink: ContentURI, claim: string, gateway: DVoteGateway) {
    if (!merkleTreeLink || !claim || !gateway) throw new Error("Invalid parameters")
    else if (!merkleTreeLink.ipfsHash) throw new Error("The link to the census needs to contain an IPFS link")

    if (merkleTreeLink.ipfsHash) {
        return gateway.sendMessage({ method: "genProof", /* ... */ }).then(response => {
            if (!response.siblings) throw new Error("The proof could not be fetched")
            // TODO: 

            throw new Error("TODO: unimplemented")
        })
    }
    else { // merkleTreeLink.hash
        return gateway.sendMessage({ method: "genProof", /* ... */ }).then(response => {
            if (!response.siblings) throw new Error("The proof could not be fetched")
            // TODO: 

            throw new Error("TODO: unimplemented")
        })
    }
}

export function checkProof() {
    throw new Error("TODO: Unimplemented")
}
