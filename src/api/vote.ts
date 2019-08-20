import { getVotingProcessContractInstance } from "../net/contract"
import GatewayInfo from "../util/gateway-info"
// import { utils, Wallet, Signer } from "ethers"
import { DVoteGateway } from "../net/gateway"
import { fetchFileString } from "./file"

export {
    deployVotingProcessContract,
    getVotingProcessContractInstance
} from "../net/contract"

// /**
//  * Compute the derived public key given a processId
//  * @param publicKey 
//  * @param processId 
//  */
// export function derivePublicKey(publicKey: string, processId: string): string {
//     throw new Error("TODO: unimplemented")
// }

// /**
//  * Compute the derived private key given a processId
//  * @param privateKey 
//  * @param processId 
//  */
// export function derivePrivateKey(privateKey: string, processId: string): string {
//     throw new Error("TODO: unimplemented")
// }

/**
 * Fetch the JSON metadata for the given processId using the given gateway
 * @param processId 
 * @param votingProcessContractAddress
 * @param gatewayUri 
 */
export async function getVoteMetadata(processId: string, votingProcessContractAddress: string, gateway: GatewayInfo): Promise<string> {
    if (!processId) throw new Error("Invalid processId")
    else if (!votingProcessContractAddress) throw new Error("Invalid votingProcessContractAddress")
    else if (!gateway || !(gateway instanceof GatewayInfo)) throw new Error("Invalid Gateway URI object")

    const processInstance = getVotingProcessContractInstance({ gatewayUri: gateway.web3 }, votingProcessContractAddress)

    try {
        const data = await processInstance.get(processId)

        if (!data.metadata) throw new Error("The given voting process has no metadata")

        const gw = new DVoteGateway(gateway.dvote, gateway.supportedApis, gateway.publicKey)
        const jsonBuffer = await fetchFileString(data.metadata, gw)
        gw.disconnect()

        return JSON.parse(jsonBuffer.toString())
    }
    catch (err) {
        console.error(err)
        throw new Error("Could not fetch the process data")
    }
}

/**
 * Fetch the modulus group of the given process census using the given gateway
 * @param processId 
 * @param address
 * @param gatewayUri 
 */
export async function getMerkleProof(processId: string, address: number, gatewayUri: string): Promise<string> {
    const metadata = await this.getMetadata(processId, gatewayUri)

    // TODO: Use the CensusService Object

    // TODO: Check that the vote type == ZK Snarks
    // TODO:

    throw new Error("unimplemented")
}

// /**
//  * Fetch the modulus group of the given process census using the given gateway
//  * @param processId 
//  * @param gatewayUri 
//  * @param publicKeyModulus
//  */
// export async function getVotingRing(processId: string, gatewayUri: string, publicKeyModulus: number): Promise<boolean> {
//     // Ensure we are connected to the right Gateway
//     if (!this.gateway) this.gateway = new Gateway(gatewayUri)
//     else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

//     return this.gateway.request({
//         method: "getVotingRing",
//         processId,
//         publicKeyModulus
//     }).then(strData => JSON.parse(strData))
// }

// /**
//  * Submit the vote envelope to a Gateway
//  * @param voteEnvelope
//  * @param processId 
//  * @param gatewayUri 
//  */
// export async function submitVoteEnvelope(voteEnvelope: VoteEnvelopeLRS | VoteEnvelopeZK, processId: string, gatewayUri: string): Promise<boolean> {
//     throw new Error("unimplemented")

//     if (voteEnvelope.type == "lrs-envelope") {

//     }
//     else { // zk-snarks-envelope

//     }

//     // TODO: Encode in base64
//     // TODO: Encrypt vote envelope with the public key of the Relay
//     const encryptedEnvelope = JSON.stringify(voteEnvelope)

//     // Ensure we are connected to the right Gateway
//     if (!this.gateway) this.gateway = new Gateway(gatewayUri)
//     else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

//     return this.gateway.request({
//         method: "submitVoteEnvelope",
//         processId,
//         encryptedEnvelope,
//     }).then(strData => JSON.parse(strData))
// }

// /**
//  * 
//  * @param processId 
//  * @param gatewayUri 
//  * @param nullifier
//  */
// export async function getVoteStatus(processId: string, gatewayUri: string, nullifier: string): Promise<boolean> {
//     // Ensure we are connected to the right Gateway
//     if (!this.gateway) this.gateway = new Gateway(gatewayUri)
//     else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

//     return this.gateway.request({
//         method: "getVoteStatus",
//         processId,
//         nullifier
//     }).then(strData => JSON.parse(strData))
// }

// /**
//  * Fetches the vote batch of a given processId
//  * @param processId 
//  * @param gatewayUri 
//  * @param batchNumber
//  */
// export async function fetchVoteBatch(processId: string, gatewayUri: string, batchNumber: number): Promise<string> {
//     if (!this.contractInstance) throw new Error("Please, attach to an instance or deploy one")

//     const contentUri = await this.contractInstance.getBatch(processId, batchNumber)
//     if (!contentUri) throw new Error("A vote batch with the given number does not exist on process " + processId)

//     // Ensure we are connected to the right Gateway
//     const gateway = new DVoteGateway(gatewayUri)

//     const jsonBuffer = await this.gateway.fetchFile(contentUri)
//     return jsonBuffer.toString("base64")
// }

// COMPUTATION METHODS

// export function packageVote(votePkg: VotePackageLRS | VotePackageZK, relayPublicKey: string): VoteEnvelopeLRS | VoteEnvelopeZK {
//     if (votePkg.type == "lrs-package") {
//         return this.packageLrsVote(votePkg, relayPublicKey)
//     }
//     else if (votePkg.type == "zk-snarks-package") {
//         return this.packageZkVote(votePkg, relayPublicKey)
//     }
//     throw new Error("Unsupported vote type")
// }

// // INTERNAL HELPERS

// function packageLrsVote(votePkg: VotePackageLRS, relayPublicKey: string): VoteEnvelopeLRS {
//     throw new Error("unimplemented")
// }

function packageZkVote(votePkg: VotePackageZK, relayPublicKey: string): VoteEnvelopeZK {
    throw new Error("unimplemented")
}


// TYPES

// export type VotePackageLRS = {
//     type: "lrs-package"
// }
export type VotePackageZK = {
    type: "zk-snarks-package"
}
// export type VoteEnvelopeLRS = {
//     type: "lrs-envelope"
// }
export type VoteEnvelopeZK = {
    type: "zk-snarks-envelope"
}
