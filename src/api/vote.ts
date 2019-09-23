import { Wallet, Signer } from "ethers"
import { getVotingProcessInstance } from "../net/contracts"
import GatewayInfo from "../wrappers/gateway-info"
import { DVoteGateway, Web3Gateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata } from "../models/voting-process"
// import { HexString } from "../models/common"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { getEntityMetadata, updateEntity, getEntityId } from "./entity"
import { VOCHAIN_BLOCK_TIME } from "../constants"

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
        const tx = await processInstance.create(processMetaOrigin, merkleRoot, merkleTree.toContentUriString(),
            processMetadata.startBlock, processMetadata.numberOfBlocks)
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
 * Retrieves the number of blocks on the Vochain
 * @param gateway 
 */
export function getBlockHeight(gateway: DVoteGateway): Promise<number> {
    if (!gateway || !(gateway instanceof DVoteGateway)) Promise.reject(new Error("Invalid Gateway object"))    

    return gateway.sendMessage({ method: "getBlockHeight"})
    .then(response => {
        if (!response.ok) throw new Error("The block height could not be retrieved")
        if (!response.height || isNaN(response.height)) throw new Error("The gateway response is not correct")
        return response.height
    })
}

/**
 * Submit the vote envelope to a Gateway
 * @param voteEnvelope
 * @param processId 
 * @param gateway 
 */
export async function submitEnvelope(voteEnvelope: SnarkVoteEnvelope | PollVoteEnvelope, processId: string, gateway: DVoteGateway): Promise<boolean> {
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
export async function getEnvelopeStatus(processId: string, gateway: DVoteGateway, nullifier: string): Promise<boolean> {
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
 * @param nullifier
 */
export async function getEnvelope(processId: string, gateway: DVoteGateway, nullifier: string): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Fetches the number of vote envelopes for a given processId
 * @param processId 
 * @param gateway 
 */
export function getEnvelopeHeight(processId: string, gateway: DVoteGateway): Promise<number> {
    if (!gateway || !processId ) return Promise.reject(new Error("No process ID provided"))    
    if (!(gateway instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))  
    
    return gateway.sendMessage({ method: "getEnvelopeHeight", processId})
    .then(response => {
        if (!response.ok) throw new Error("The envelope height could not be retrieved")
        if (!response.height || isNaN(response.height)) throw new Error("The gateway response is not correct")
        return response.height
    })
}

/**
 * Retrieves the number of seconds left before the given process starts.
 * Returns 0 if it already started
 * @param processId ID of the voting process
 * @param startBlock Tendermint block on which the process starts
 * @param gateway DVote Gateway instance
 */
export function getTimeUntilStart(processId: string, startBlock: number, dvoteGw: DVoteGateway): Promise<number> {
    if (!processId || !startBlock || !dvoteGw) throw new Error("Invalid parameters")

    return getBlockHeight(dvoteGw).then(currentHeight => {
        const remainingBlocks = startBlock - currentHeight
        if (remainingBlocks <= 0) return 0
        else return remainingBlocks * VOCHAIN_BLOCK_TIME
    }).catch(err => {
        console.error(err)
        throw new Error("The process start block could not be determined")
    })
}

/**
 * Retrieves the number of seconds left before the given process ends.
 * Returns 0 if it already ended
 * @param processId ID of the voting process
 * @param startBlock Tendermint block on which the process starts
 * @param numberOfBlocks Number of Tendermint blocks that the voting process is active
 * @param gateway DVote Gateway instance
 */
export function getTimeUntilEnd(processId: string, startBlock: number, numberOfBlocks: number, dvoteGw: DVoteGateway): Promise<number> {
    if (!processId || !startBlock || !numberOfBlocks || !dvoteGw) throw new Error("Invalid parameters")

    return getBlockHeight(dvoteGw).then(currentHeight => {
        const remainingBlocks = (startBlock + numberOfBlocks) - currentHeight
        if (remainingBlocks <= 0) return 0
        else return remainingBlocks * VOCHAIN_BLOCK_TIME
    }).catch(err => {
        console.error(err)
        throw new Error("The process deadline could not be determined")
    })
}

/**
 * Fetches the list pf processes for a given entity
 * @param processId 
 * @param gateway 
 */
export async function getProcessList(processId: string, gateway: GatewayInfo): Promise<string> {

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

// TODO: SEE https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

export function packageSnarkEnvelope(param1: any, etc): SnarkVoteEnvelope {

    // TODO: use packageSnarkVote
    throw new Error("TODO: unimplemented")
}

export function packagePollEnvelope(param1: any, etc): PollVoteEnvelope {

    // TODO: use packagePollVote
    throw new Error("TODO: unimplemented")
}

export function packageSnarkVote(param1: any, etc): String {
    throw new Error("TODO: unimplemented")
}

export function packagePollVote(param1: any, etc): String {
    throw new Error("TODO: unimplemented")
}


// TYPES

// SNARK
export type SnarkVoteEnvelope = {
    processId: string,
    proof: string,  // ZK Proof
    nullifier: string,   // Hash of the private key
    "vote-package": string  // base64(jsonString) is encrypted
}
export type SnarkVotePackage = {
    type: "snark-vote", // One of: snark-vote, poll-vote, petition-sign
    nonce: string, // random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Direclty mapped to the `questions` field of the metadata
}

// POLL
export type PollVoteEnvelope = {
    processId: string,
    proof: string,  // Merkle Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    "vote-package": string,  // base64(json(votePackage))
    signature: string
}
export type PollVotePackage = {
    type: "poll-vote", // One of: snark-vote, poll-vote, petition-sign
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Direclty mapped to the `questions` field of the metadata
}
