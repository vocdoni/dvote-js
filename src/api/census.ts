import { Wallet, Signer } from "ethers"
import { IDVoteGateway, IDvoteRequestParameters } from "../net/gateway"
import { sha3_256 } from 'js-sha3'
// import ContentURI from "../wrappers/content-uri"
import { hashBuffer } from "../util/hashing"
const { Buffer } = require("buffer/")
import * as ArrayBuffToString from 'arraybuffer-to-string'

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
 * Hashes the given hex string ECDSA public key and returns the
 * base 64 representation of the resulting big int
 */
export function digestHexClaim(publicKey: string): string {
    const pubKeyBytes = hexStringToBuffer(publicKey)
    let hashNumHex: string = hashBuffer(pubKeyBytes).toString(16)
    if (hashNumHex.length % 2 != 0) hashNumHex = "0" + hashNumHex

    const hashBuff = hexStringToBuffer(hashNumHex)
    return ArrayBuffToString(hashBuff, "base64")
}

/**
 * Asks the Gateway to create a new census and set the given public key as the ones who can manage it
 * @param censusName Name given to the census. Will be used to generate the census ID by trimming spaces and converting text to lowercase 
 * @param managerPublicKeys ECDSA public key(s) that can manage this census
 * @param gateway A DVoteGateway instance connected to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export async function addCensus(censusName: string, managerPublicKeys: string[], gateway: IDVoteGateway, walletOrSigner: Wallet | Signer): Promise<{ censusId: string, merkleRoot: string }> {
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
 * Asks the Gateway to add the given public key to a census previously registered on it.
 * NOTE: This function is intended to be called from NodeJS 10+
 * 
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
 * @param claimData A stirng containing the digest of the Public Key (see `digestHexClaim()`)
 * @param gateway A DVoteGateway instance pointing to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export function addClaim(censusId: string, claimData: string, gateway: IDVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !claimData || !claimData.length || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "addClaim", censusId, claimData }, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The claim could not be added")

        return getRoot(censusId, gateway)
    })
}

/**
 * Asks the Gateway to add the given public key to a census previously registered on it
 * NOTE: This function is intended to be called from NodeJS 10+
 * 
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
 * @param claimsData A stirng containing the digest of the users' Public Keys (see `digestHexClaim()`)
 * @param gateway A DVoteGateway instance pointing to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the new merkleRoot
 */
export async function addClaimBulk(censusId: string, claimsData: string[], gateway: IDVoteGateway, walletOrSigner: Wallet | Signer): Promise<{ merkleRoot: string, invalidClaims: any[] }> {
    if (!censusId || !claimsData || !claimsData.length || !gateway) throw new Error("Invalid parameters")

    const response = await gateway.sendMessage({ method: "addClaimBulk", censusId, claimsData }, walletOrSigner)
    if (!response.ok) throw new Error("The given claims could not be added")
    const invalidClaims = ("invalidClaims" in response) ? response.invalidClaims : []

    const merkleRoot = await getRoot(censusId, gateway)

    return { merkleRoot, invalidClaims }
}

/**
 * Asks the Gateway to fetch 
 * @param censusId The full Census ID to fetch from the Gateway
 * @param gateway A DVoteGateway instance pointing to a remote Gateway
 * @returns Promise resolving with the merkleRoot
 */
export function getRoot(censusId: string, gateway: IDVoteGateway): Promise<string> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "getRoot", censusId }).then(response => {
        if (!response.ok || !response.root) throw new Error("The census merkle root could not be fetched")
        return response.root
    })
}

/**
 * Get the number of people in the census with the given Merkle Root Hash
 * @param censusMerkleRootHash The Merkle Root of the census to fetch from the Gateway
 * @param dvoteGw A DVoteGateway instance pointing to a remote Gateway
 * @returns Promise resolving with the census size
 */
export function getCensusSize(censusMerkleRootHash: string, dvoteGw: IDVoteGateway): Promise<string> {
    if (!censusMerkleRootHash || !dvoteGw) throw new Error("Invalid parameters")

    return dvoteGw.sendMessage({ method: "getSize", censusId: censusMerkleRootHash }).then(response => {
        if (!response.ok || isNaN(response.size)) throw new Error("The census size could not be retrieved")
        return response.size
    })
}

/** Dumps the entire content of the census as an array of hexStrings rady to be imported to another census service 
 *  
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
 * @param gateway A DVoteGateway instance pointing to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the a hex array dump of the census claims
*/
export function dump(censusId: string, gateway: IDVoteGateway, walletOrSigner: Wallet | Signer, rootHash?: String): Promise<string[]> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")
    const msg: IDvoteRequestParameters = (rootHash) ? { method: "dump", censusId, rootHash } : { method: "dump", censusId }

    return gateway.sendMessage(msg, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The census merkle root could not be fetched")
        return (response.claimsData && response.claimsData.length) ? response.claimsData : []
    })
}

/** Dumps the contents of a census in raw string format. Not valid to use with `importDump`
 *  
 * @param censusId Full Census ID containing the Entity ID and the hash of the original name
 * @param gateway A DVoteGateway instance pointing to a remote Gateway
 * @param walletOrSigner 
 * @returns Promise resolving with the a raw string dump of the census claims
*/
export function dumpPlain(censusId: string, gateway: IDVoteGateway, walletOrSigner: Wallet | Signer, rootHash?: String): Promise<string[]> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")
    const msg: IDvoteRequestParameters = (rootHash) ? { method: "dumpPlain", censusId, rootHash } : { method: "dumpPlain", censusId }

    return gateway.sendMessage(msg, walletOrSigner).then(response => {
        if (!response.ok) throw new Error("The census merkle root could not be fetched")
        return (response.claimsData && response.claimsData.length) ? response.claimsData : []
    })

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
export function publishCensus(censusId: string, gateway: IDVoteGateway, walletOrSigner: Wallet | Signer): Promise<string> {
    if (!censusId || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({ method: "publish", censusId }, walletOrSigner).then(response => {
        if (!response.uri) throw new Error("The census claim URI could not be retrieved")
        return response.uri
    })
}

/**
 * Fetch the proof of the given claim on the given census merkleTree using the given gateway
 * @param censusMerkleRoot The Merkle Root of the Census to query
 * @param base64Claim Base64-encoded claim of the leaf to request
 * @param gateway 
 */
export function generateProof(censusMerkleRoot: string, base64Claim: string, gateway: IDVoteGateway): Promise<string> {
    if (!censusMerkleRoot || !base64Claim || !gateway) throw new Error("Invalid parameters")

    return gateway.sendMessage({
        method: "genProof",
        censusId: censusMerkleRoot,
        claimData: base64Claim,
    }).then(response => {
        if (typeof response.siblings != "string" || !response.siblings.length) throw new Error("The Merkle Proof could not be fetched")
        return response.siblings
    })
}

// export function checkProof() {
//     throw new Error("TODO: Unimplemented")
// }

///////////////////////////////////////////////////////////////////////////////
// INTERNAL HELPERS
///////////////////////////////////////////////////////////////////////////////

function hexStringToBuffer(hexString: string): Buffer {
    if (!/^(0x)?[0-9a-fA-F]+$/.test(hexString)) throw new Error("Invalid hex string")
    hexString = hexString.replace(/^0x/, "")

    const result = new Buffer(Math.ceil(hexString.length / 2));
    for (let i = 0; i < result.length; i++) {
        result[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    return result
}
