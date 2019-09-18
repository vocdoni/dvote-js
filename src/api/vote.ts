import { Wallet, Signer } from "ethers"
import { getVotingProcessInstance } from "../net/contracts"
import GatewayInfo from "../wrappers/gateway-info"
import { DVoteGateway, Web3Gateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata } from "../models/voting-process"
import { HexString } from "../models/common"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { getEntityMetadata, updateEntity, getEntityId } from "./entity"

/**
 * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
 * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
 * @param processMetadata JSON object containing the schema defined on  https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 * @param walletOrSigner
 * @param gatewayInfo
 * @returns The process ID
 */
export async function createVotingProcess(processMetadata: ProcessMetadata,
    walletOrSigner: Wallet | Signer, gatewayInfo: GatewayInfo): Promise<string> {
    if (!processMetadata) throw new Error("Invalid process metadata")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gatewayInfo || !(gatewayInfo instanceof GatewayInfo)) throw new Error("Invalid Gateway Info object")

    // throw if not valid
    checkValidProcessMetadata(processMetadata)
    const merkleRoot = processMetadata.census.merkleRoot
    const merkleTree = new ContentHashedURI(processMetadata.census.merkleTree)

    const gw = new DVoteGateway(gatewayInfo)
    const web3 = new Web3Gateway(gatewayInfo)

    try {
        const processInstance = await getVotingProcessInstance({
            provider: web3.getProvider(),
            signer: walletOrSigner instanceof Signer ? walletOrSigner : undefined,
            wallet: walletOrSigner instanceof Wallet ? walletOrSigner : undefined
        })
        const address = await walletOrSigner.getAddress()

        // CHECK THAT THE ENTITY EXISTS
        const entityMeta = await getEntityMetadata(address, gatewayInfo)
        if (!entityMeta) throw new Error("The entity is not yet registered on the blockchain")
        else if (getEntityId(address) != processMetadata.details.entityId)
            throw new Error("The EntityId on the metadata does not match the given wallet's address")

        // UPLOAD THE METADATA
        await gw.connect()
        const strJsonMeta = JSON.stringify(processMetadata)
        const processMetaOrigin = await addFile(strJsonMeta, `merkle-root-${merkleRoot}.json`, walletOrSigner, gw)
        gw.disconnect()
        if (!processMetaOrigin) throw new Error("The process metadata could not be uploaded")

        // REGISTER THE NEW PROCESS
        const tx = await processInstance.create(processMetaOrigin, merkleRoot, merkleTree.toContentUriString())
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()

        const count = await processInstance.getEntityProcessCount(address)
        if (!count || count.isZero()) throw new Error("The process could not be created")
        const processId = await processInstance.getProcessId(address, count.toNumber() - 1)

        // UPDATE THE ENTITY
        if (!entityMeta.votingProcesses) entityMeta.votingProcesses = { active: [], ended: [] }
        entityMeta.votingProcesses.active = [processId].concat(entityMeta.votingProcesses.active || [])

        await updateEntity(address, entityMeta, walletOrSigner, gatewayInfo)

        return processId
    }
    catch (err) {
        if (gw) gw.disconnect()
        console.error(err)
        throw err
    }
}

/**
 * Fetch the JSON metadata for the given processId using the given gateway
 * @param processId 
 * @param gateway
 */
export async function getVoteMetadata(processId: string, gatewayInfo: GatewayInfo): Promise<ProcessMetadata> {
    if (!processId) throw new Error("Invalid processId")
    else if (!gatewayInfo || !(gatewayInfo instanceof GatewayInfo)) throw new Error("Invalid Gateway Info object")

    const web3 = new Web3Gateway(gatewayInfo)
    const processInstance = await getVotingProcessInstance({ provider: web3.getProvider() })

    try {
        const data = await processInstance.get(processId)

        if (!data.metadata) throw new Error("The given voting process has no metadata")

        const gw = new DVoteGateway(gatewayInfo)
        await gw.connect()
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
 * Fetch the JSON metadata for a set of process ID's using the given gateway
 * @param processIds
 * @param gateway
 */
export function getVotesMetadata(processIds: string[], gatewayInfo: GatewayInfo): Promise<ProcessMetadata[]> {
    if (!Array.isArray(processIds)) Promise.reject(new Error("Invalid processIds"))
    else if (!gatewayInfo || !(gatewayInfo instanceof GatewayInfo)) Promise.reject(new Error("Invalid Gateway Info object"))

    return Promise.all(processIds.map(id => getVoteMetadata(id, gatewayInfo)))
}

/**
 * Submit the vote envelope to a Gateway
 * @param voteEnvelope
 * @param processId 
 * @param gateway 
 */
export async function submitEnvelope(voteEnvelope: VoteEnvelopeSnark, processId: string, gateway: GatewayInfo): Promise<boolean> {
    //     throw new Error("unimplemented")

    //     if (voteEnvelope.type == "lrs-envelope") {

    //     }
    //     else { // snark-envelope

    //     }

    //     // TODO: Encode in base64
    //     // TODO: Encrypt vote envelope with the public key of the Relay
    //     const encryptedEnvelope = JSON.stringify(voteEnvelope)

    //     // Ensure we are connected to the right Gateway
    //     if (!this.gateway) this.gateway = new Gateway(gateway)
    //     else if (await this.gateway.getUri() != gateway) await this.gateway.connect(gateway)

    //     return this.gateway.request({
    //         method: "submitEnvelope",
    //         processId,
    //         encryptedEnvelope,
    //     }).then(strData => JSON.parse(strData))

    throw new Error("TODO: unimplemented")
}

/**
 * 
 * @param processId 
 * @param gateway 
 * @param nullifier
 */
export async function getEnvelopeStatus(processId: string, gateway: GatewayInfo, nullifier: string): Promise<boolean> {
    //     // Ensure we are connected to the right Gateway
    //     if (!this.gateway) this.gateway = new Gateway(gateway)
    //     else if (await this.gateway.getUri() != gateway) await this.gateway.connect(gateway)

    //     return this.gateway.request({
    //         method: "getEnvelopeStatus",
    //         processId,
    //         nullifier
    //     }).then(strData => JSON.parse(strData))

    throw new Error("TODO: unimplemented")
}

/**
 * Fetches the vote envelope for a given processId
 * @param processId 
 * @param gateway 
 * @param batchNumber
 */
export async function getEnvelope(processId: string, gateway: GatewayInfo, batchNumber: number): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Fetches the number of vote envelopes for a given processId
 * @param processId 
 * @param gateway 
 * @param batchNumber
 */
export async function getEnvelopeHeight(processId: string, gateway: GatewayInfo, batchNumber: number): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Fetches the list pf processes for a given entity
 * @param processId 
 * @param gateway 
 * @param batchNumber
 */
export async function getProcessList(processId: string, gateway: GatewayInfo, batchNumber: number): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Fetches the list of envelopes for a given processId
 * @param processId 
 * @param gateway 
 * @param batchNumber
 */
export async function getEnvelopeList(processId: string, gateway: GatewayInfo, batchNumber: number): Promise<string> {

    throw new Error("TODO: unimplemented")

}

// COMPUTATION

// export function packageVote(votePkg: VotePackageLRS | VotePackageSnark, relayPublicKey: string): VoteEnvelopeLRS | VoteEnvelopeSnark {
//     if (votePkg.type == "lrs-package") {
//         return this.packageLrsVote(votePkg, relayPublicKey)
//     }
//     else if (votePkg.type == "snark-package") {
//         return this.packageSnarkVote(votePkg, relayPublicKey)
//     }
//     throw new Error("Unsupported vote type")
// }

// // LRS OUTDATED FUNCTIONS

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

// /**
//  * Fetch the modulus group of the given process census using the given gateway
//  * @param processId 
//  * @param gateway 
//  * @param publicKeyModulus
//  */
// export async function getVotingRing(processId: string, gateway: GatewayInfo, publicKeyModulus: number): Promise<boolean> {
//     // Ensure we are connected to the right Gateway
//     if (!this.gateway) this.gateway = new Gateway(gateway)
//     else if (await this.gateway.getUri() != gateway) await this.gateway.connect(gateway)

//     return this.gateway.request({
//         method: "getVotingRing",
//         processId,
//         publicKeyModulus
//     }).then(strData => JSON.parse(strData))
// }

// INTERNAL HELPERS

function packageSnarkVote(votePkg: VotePackageSnark, relayPublicKey: string): VoteEnvelopeSnark {
    throw new Error("unimplemented")
}

// function packageLrsVote(votePkg: VotePackageLRS, relayPublicKey: string): VoteEnvelopeLRS {
//     throw new Error("unimplemented")
// }


// TYPES

export type VotePackageSnark = {
    type: "snark-package"
}
// export type VotePackageLRS = {
//     type: "lrs-package"
// }
export type VoteEnvelopeSnark = {
    type: "snark-envelope"
}
// export type VoteEnvelopeLRS = {
//     type: "lrs-envelope"
// }
