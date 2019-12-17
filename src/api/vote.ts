import { Wallet, Signer, utils } from "ethers"
import { getVotingProcessInstance } from "../net/contracts"
import { DVoteGateway, Web3Gateway, IDVoteGateway, IWeb3Gateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata } from "../models/voting-process"
// import { HexString } from "../models/common"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { getEntityMetadataByAddress, updateEntity, getEntityId } from "./entity"
import { VOCHAIN_BLOCK_TIME } from "../constants"
import { signJsonBody } from "../util/json-sign"
import { getArrayBufferFromString, getBase64StringFromArrayBuffer } from "../util/convert"

/**
 * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
 * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
 * @param processMetadata JSON object containing the schema defined on  https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 * @param walletOrSigner
 * @param web3Gateway
 * @param dboteGateway
 * @returns The process ID
 */
export async function createVotingProcess(processMetadata: ProcessMetadata,
    walletOrSigner: Wallet | Signer, web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<string> {
    if (!processMetadata) throw new Error("Invalid process metadata")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!(web3Gateway instanceof Web3Gateway) || !(dvoteGateway instanceof DVoteGateway)) throw new Error("Invalid Gateway object")

    // throw if not valid
    checkValidProcessMetadata(processMetadata)
    const merkleRoot = processMetadata.census.merkleRoot
    const merkleTree = new ContentHashedURI(processMetadata.census.merkleTree)

    try {
        const processInstance = await getVotingProcessInstance({
            provider: web3Gateway.getProvider(),
            signer: walletOrSigner instanceof Signer ? walletOrSigner : undefined,
            wallet: walletOrSigner instanceof Wallet ? walletOrSigner : undefined
        })
        const address = await walletOrSigner.getAddress()

        // CHECK THAT THE ENTITY EXISTS
        const entityMeta = await getEntityMetadataByAddress(address, web3Gateway, dvoteGateway)
        if (!entityMeta) throw new Error("The entity is not yet registered on the blockchain")
        else if (getEntityId(address) != processMetadata.details.entityId)
            throw new Error("The EntityId on the metadata does not match the given wallet's address")

        // UPLOAD THE METADATA
        const strJsonMeta = JSON.stringify(processMetadata)
        const processMetaOrigin = await addFile(strJsonMeta, `merkle-root-${merkleRoot}.json`, walletOrSigner, dvoteGateway)
        if (!processMetaOrigin) throw new Error("The process metadata could not be uploaded")

        // REGISTER THE NEW PROCESS
        const tx = await processInstance.create(processMetadata.type, processMetaOrigin, merkleRoot, merkleTree.toContentUriString(),
            processMetadata.startBlock, processMetadata.numberOfBlocks)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()

        const count = await processInstance.getEntityProcessCount(address)
        if (!count || count.isZero()) throw new Error("The process could not be created")
        const processId = await processInstance.getProcessId(address, count.toNumber() - 1)

        // UPDATE THE ENTITY
        if (!entityMeta.votingProcesses) entityMeta.votingProcesses = { active: [], ended: [] }
        entityMeta.votingProcesses.active = [processId].concat(entityMeta.votingProcesses.active || [])

        await updateEntity(address, entityMeta, walletOrSigner, web3Gateway, dvoteGateway)

        return processId
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Fetch the JSON metadata for the given processId using the given gateway
 * @param processId 
 * @param gateway
 */
export async function getVoteMetadata(processId: string, web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<ProcessMetadata> {
    if (!processId) throw new Error("Invalid processId")
    else if (!(web3Gateway instanceof Web3Gateway) || !(dvoteGateway instanceof DVoteGateway)) throw new Error("Invalid Gateway object")

    const processInstance = await getVotingProcessInstance({ provider: web3Gateway.getProvider() })

    try {
        const data = await processInstance.get(processId)

        if (!data.metadata) throw new Error("The given voting process has no metadata")

        const jsonBuffer = await fetchFileString(data.metadata, dvoteGateway)

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
export function getVotesMetadata(processIds: string[], web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<ProcessMetadata[]> {
    if (!Array.isArray(processIds)) Promise.reject(new Error("Invalid processIds"))
    else if (!(web3Gateway instanceof Web3Gateway) || !(dvoteGateway instanceof DVoteGateway)) Promise.reject(new Error("Invalid Gateway object"))

    return Promise.all(processIds.map(id => getVoteMetadata(id, web3Gateway, dvoteGateway)))
}

/**
 * Retrieves the number of blocks on the Vochain
 * @param gateway 
 */
export function getBlockHeight(gateway: IDVoteGateway): Promise<number> {
    if (!gateway || !(gateway instanceof DVoteGateway)) Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getBlockHeight" })
        .then(response => {
            if (!response || !response["ok"]) throw new Error("Could not retrieve the number of blocks")
            else if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The gateway response is not correct")
            return response.height
        })
}

/**
 * Submit the vote envelope to a Gateway
 * @param voteEnvelope
 * @param gateway 
 */
export async function submitEnvelope(voteEnvelope: SnarkVoteEnvelope | PollVoteEnvelope, gateway: IDVoteGateway): Promise<void> {
    if (!voteEnvelope) throw new Error("Invalid parameters")
    else if (!gateway || !(gateway instanceof DVoteGateway)) Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({
        method: "submitEnvelope",
        payload: voteEnvelope
    }).then(res => {
        if (!res || !res["ok"]) throw new Error("Could not submit the vote envelope")
    }).catch(err => {
        throw new Error("Could not submit the vote envelope")
    })
}

/**
 * Get status of envelope (submitted or not)
 * @param processId
 * @param nullifier
 * @param gateway
 */
export function getEnvelopeStatus(processId: string, nullifier: string, gateway: IDVoteGateway): Promise<boolean> {
    if (!processId || !nullifier) return Promise.reject(new Error("Invalid parameters"))
    if (!(gateway instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelopeStatus", processId, nullifier })
        .then(response => {
            if (!response || !response["ok"]) throw new Error("Could not check the envelope status")
            else if (typeof response.registered != "boolean") throw new Error("Invalid response received from the gateway")
            return response.registered
        }).catch(err => {
            console.error(err)
            throw new Error("The envelope status could not be retrieved")
        })
}

/**
 * Fetches the vote envelope for a given processId
 * @param processId 
 * @param gateway 
 * @param nullifier
 */
export async function getEnvelope(processId: string, gateway: IDVoteGateway, nullifier: string): Promise<string> {
    if (!gateway || !processId) return Promise.reject(new Error("No process ID provided"))
    if (!(gateway instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelope", nullifier, processId })
        .then(response => {
            if (!response || !response["ok"]) throw new Error("Could not get the envelope data")
            else if (!response.payload) throw new Error("The envelope could not be retrieved")
            // if (!(response.payload instanceof String)) throw new Error("Envlope content not correct")
            return response.payload
        })
}

/**
 * Fetches the number of vote envelopes for a given processId
 * @param processId 
 * @param gateway 
 */
export function getEnvelopeHeight(processId: string, dvoteGw: IDVoteGateway): Promise<number> {
    if (!dvoteGw || !processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return dvoteGw.sendMessage({ method: "getEnvelopeHeight", processId })
        .then(response => {
            if (!response || !response["ok"]) throw new Error("Could not get the envelope height")
            else if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The gateway response is not correct")
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
export function getTimeUntilStart(processId: string, startBlock: number, dvoteGw: IDVoteGateway): Promise<number> {
    if (!processId || isNaN(startBlock)) throw new Error("Invalid parameters")
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

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
export function getTimeUntilEnd(processId: string, startBlock: number, numberOfBlocks: number, dvoteGw: IDVoteGateway): Promise<number> {
    if (!processId || isNaN(startBlock) || isNaN(numberOfBlocks)) throw new Error("Invalid parameters")
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

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
 * Returns the DateTime at which the given block number is expected to be mined
 * @param processId ID of the voting process
 * @param blockNumber Number of block to compute the date for
 * @param gateway DVote Gateway instance
 */
export function getTimeForBlock(processId: string, blockNumber: number, dvoteGw: IDVoteGateway): Promise<Date> {
    if (!processId || isNaN(blockNumber)) throw new Error("Invalid parameters")
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(dvoteGw).then(currentHeight => {
        const blockDifference = blockNumber - currentHeight
        const now = Date.now()
        return new Date(now + (blockDifference * VOCHAIN_BLOCK_TIME * 1000))
    }).catch(err => {
        console.error(err)
        throw new Error("The process deadline could not be determined")
    })
}

/**
 * Returns the block number that is expected to be mined at the given date and time
 * @param processId ID of the voting process
 * @param date The date and time to compute the block number for
 * @param gateway DVote Gateway instance
 */
export function getBlockNumberForTime(processId: string, dateTime: Date, dvoteGw: IDVoteGateway): Promise<number> {
    if (!processId || !(dateTime instanceof Date)) throw new Error("Invalid parameters")
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(dvoteGw).then(currentHeight => {
        const blockDiff = Math.floor((dateTime.getTime() - Date.now()) / 1000 / VOCHAIN_BLOCK_TIME)

        return Math.max(currentHeight + blockDiff, 0)
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
export async function getProcessList(processId: string, web3Gateway: IWeb3Gateway, dvoteGw: IDVoteGateway): Promise<string> {

    throw new Error("TODO: unimplemented")

}

/**
 * Fetches the list of envelopes for a given processId
 * @param processId 
 * @param from
 * @param listSize
 * @param gateway 
 * @returns List of submited votes nullifiers
 */
export async function getEnvelopeList(processId: string,
    from: number, listSize: number, dvoteGw: IDVoteGateway): Promise<string[]> {
    if (!processId || isNaN(from) || isNaN(listSize) || !dvoteGw) throw new Error("Invalid parameters")

    return dvoteGw.sendMessage({ method: "getEnvelopeList", processId, from, listSize })
        .then(response => {
            if (!response || !response["ok"]) throw new Error("Could not get the envelope height")
            else if (!Array.isArray(response.nullifiers)) throw new Error("The gateway response is not correct")
            return response.nullifiers
        })
}

// COMPUTATION

// TODO: SEE https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

export function packageSnarkEnvelope(votes: number[],
    merkleProof: string, processId: string, voteEncryptionPublicKey: string, walletOrSigner: Wallet | Signer): SnarkVoteEnvelope {

    // TODO: use packageSnarkVote()
    throw new Error("TODO: unimplemented")
}

export async function packagePollEnvelope(votes: number[],
    merkleProof: string, processId: string, walletOrSigner: Wallet | Signer): Promise<PollVoteEnvelope> {
    if (!votes || !merkleProof || !processId || !walletOrSigner) throw new Error("Invalid parameters");
    try {
        const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

        const votePackage: string = packagePollVote(votes)
        const pkg: PollVoteEnvelope = {
            processId: processId,
            proof: merkleProof,
            nonce,
            "vote-package": votePackage
            // signature:  Must be unset because the body must be singed without the  signature
        }

        pkg.signature = await signJsonBody(pkg, walletOrSigner)

        return pkg
    } catch (error) {
        throw "Poll vote Envelope could not be generated";
    }
}

export function packageSnarkVote(votes: number[], voteEncryptionPublicKey: string): string {
    // if (!Array.isArray(votes)) throw new Error("Invalid votes")
    // const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

    // const payload: SnarkVotePackage = {
    //     type: "snark-vote",
    //     nonce,
    //     votes
    // }

    // // TODO: ENCRYPT WITH voteEncryptionPublicKey
    // const buff = getArrayBufferFromString(JSON.stringify(payload))
    // return getBase64StringFromArrayBuffer(buff)
    throw new Error("Unimplemented")
}

export function packagePollVote(votes: number[]): string {
    if (!Array.isArray(votes)) throw new Error("Invalid votes")
    const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

    const payload: PollVotePackage = {
        type: "poll-vote",
        nonce,
        votes
    }
    const buff = getArrayBufferFromString(JSON.stringify(payload))
    return getBase64StringFromArrayBuffer(buff)
}


// TYPES

// SNARK
export type SnarkVoteEnvelope = {
    processId: string,
    proof: string,  // ZK Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    nullifier: string,   // Hash of the private key
    "vote-package": string  // base64(jsonString) is encrypted
}
export type SnarkVotePackage = {
    type: "snark-vote",
    nonce: string, // random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Directly mapped to the `questions` field of the metadata
}

// POLL
export type PollVoteEnvelope = {
    processId: string,
    proof: string,  // Merkle Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    "vote-package": string,  // base64(json(votePackage))
    signature?: string //  Signature including all the rest of the envelope (processId, proof, nonce, vote-package)
}
export type PollVotePackage = {
    type: "poll-vote",
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Directly mapped to the `questions` field of the metadata
}
