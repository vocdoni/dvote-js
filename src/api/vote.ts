import { Wallet, Signer, utils } from "ethers"
import { getVotingProcessInstance } from "../net/contracts"
import { DVoteGateway, Web3Gateway, IDVoteGateway, IWeb3Gateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata, ProcessResults, ProcessType, VochainProcessState, ProcessResultItem } from "../models/voting-process"
// import { HexString } from "../models/common"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { getEntityMetadataByAddress, updateEntity, getEntityId } from "./entity"
import { VOCHAIN_BLOCK_TIME } from "../constants"
import { signJsonBody } from "../util/json-sign"
import { Buffer } from "buffer/"  // Previously using "arraybuffer-to-string"
import { Asymmetric } from "../util/encryption"

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
    } catch (error) {
        const message = (error.message) ? "Could not fetch the process data: " + error.message : "Could not fetch the process data"
        throw new Error(message)
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

    return Promise.all(processIds.map((id) => getVoteMetadata(id, web3Gateway, dvoteGateway)))
}

/**
 * Retrieves the number of blocks on the Vochain
 * @param gateway 
 */
export function getBlockHeight(gateway: IDVoteGateway): Promise<number> {
    if (!gateway || !(gateway instanceof DVoteGateway)) Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getBlockHeight" })
        .then((response) => {
            if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The gateway response is not correct")
            return response.height
        })
        .catch((error) => {
            const message = (error.message) ? "Could not retrieve the number of blocks: " + error.message : "Could not retrieve the number of blocks"
            throw new Error(message)
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

    return gateway.sendMessage({ method: "submitEnvelope", payload: voteEnvelope })
        .catch((error) => {
            const message = (error.message) ? "Could not submit the vote envelope: " + error.message : "Could not submit the vote envelope"
            throw new Error(message)
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
        .then((response) => {
            if (typeof response.registered != "boolean") throw new Error("Invalid response received from the gateway")
            return response.registered
        })
        .catch((error) => {
            const message = (error.message) ? "The envelope status could not be retrieved: " + error.message : "The envelope status could not be retrieved"
            throw new Error(message)
        })
}

/**
 * Fetches the vote envelope for a given processId
 * @param processId 
 * @param gateway 
 * @param nullifier
 */
export async function getEnvelope(processId: string, gateway: IDVoteGateway, nullifier: string): Promise<string> {
    if (!processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(gateway instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelope", nullifier, processId })
        .then((response) => {
            if (!response.payload) throw new Error("The envelope could not be retrieved")
            // if (!(response.payload instanceof String)) throw new Error("Envlope content not correct")
            return response.payload
        })
        .catch((error) => {
            const message = (error.message) ? "Could not get the envelope data: " + error.message : "Could not get the envelope data"
            throw new Error(message)
        })
}

/**
 * Fetches the number of vote envelopes for a given processId
 * @param processId 
 * @param gateway 
 */
export function getEnvelopeHeight(processId: string, dvoteGw: IDVoteGateway): Promise<number> {
    if (!processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return dvoteGw.sendMessage({ method: "getEnvelopeHeight", processId })
        .then((response) => {
            if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The gateway response is not correct")
            return response.height
        })
        .catch((error) => {
            const message = (error.message) ? "Could not get the envelope height: " + error.message : "Could not get the envelope height"
            throw new Error(message)
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

    return getBlockHeight(dvoteGw).then((currentHeight) => {
        const remainingBlocks = startBlock - currentHeight
        if (remainingBlocks <= 0) return 0
        else return remainingBlocks * VOCHAIN_BLOCK_TIME
    })
        .catch((error) => {
            const message = (error.message) ? "The process start block could not be determined: " + error.message : "The process start block could not be determined"
            throw new Error(message)
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

    return getBlockHeight(dvoteGw).then((currentHeight) => {
        const remainingBlocks = (startBlock + numberOfBlocks) - currentHeight
        if (remainingBlocks <= 0) return 0
        else return remainingBlocks * VOCHAIN_BLOCK_TIME
    })
        .catch((error) => {
            const message = (error.message) ? "The process deadline could not be determined: " + error.message : "The process deadline could not be determined"
            throw new Error(message)
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

    return getBlockHeight(dvoteGw)
        .then((currentHeight) => {
            const blockDifference = blockNumber - currentHeight
            const now = Date.now()
            return new Date(now + (blockDifference * VOCHAIN_BLOCK_TIME * 1000))
        })
        .catch((error) => {
            const message = (error.message) ? "The block mine time could not be determined: " + error.message : "The block mine time could not be determined"
            throw new Error(message)
        })
}

/**
 * Returns the block number that is expected to be mined at the given date and time
 * @param processId ID of the voting process
 * @param date The date and time to compute the block number for
 * @param gateway DVote Gateway instance
 */
export function getBlockNumberForTime(processId: string, dateTime: Date, dvoteGw: IDVoteGateway): Promise<number> {
    if (!processId || !(dateTime instanceof Date)) return Promise.reject(new Error("Invalid parameters"))
    else if (!(dvoteGw instanceof DVoteGateway)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(dvoteGw)
        .then((currentHeight) => {
            const blockDiff = Math.floor((dateTime.getTime() - Date.now()) / 1000 / VOCHAIN_BLOCK_TIME)

            return Math.max(currentHeight + blockDiff, 0)
        })
        .catch((error) => {
            const message = (error.message) ? "The block number at the given date and time could not be determined: " +
                error.message : "The block number at the given date and time could not be determined"
            throw new Error(message)
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
export function getEnvelopeList(processId: string,
    from: number, listSize: number, dvoteGw: IDVoteGateway): Promise<string[]> {
    if (!processId || isNaN(from) || isNaN(listSize) || !dvoteGw)
        return Promise.reject(new Error("Invalid parameters"))

    return dvoteGw.sendMessage({ method: "getEnvelopeList", processId, from, listSize })
        .then((response) => {
            if (!Array.isArray(response.nullifiers)) throw new Error("The gateway response is not correct")
            return response.nullifiers
        })
        .catch((error) => {
            const message = (error.message) ? "Could not retrieve the envelope list: " + error.message : "Could not retrieve the envelope list"
            throw new Error(message)
        })
}

/**
 * Fetches the results for a given processId
 * @param processId
 * @param dvoteGateway
 * @returns Results, vote process  type, vote process state
 */
export function getRawResults(processId: string, dvoteGateway: IDVoteGateway): Promise<{ results: number[][], type: ProcessType, state: VochainProcessState }> {
    if (!dvoteGateway || !processId)
        return Promise.reject(new Error("No process ID provided"))
    else if (!(dvoteGateway instanceof DVoteGateway))
        return Promise.reject(new Error("Invalid Gateway object"))

    return dvoteGateway.sendMessage({ method: "getResults", processId })
        .then((response) => {
            if (!Array.isArray(response.results)) throw new Error("The gateway response is not valid")
            const results = (Array.isArray(response.results) && response.results.length) ? response.results : []
            const type = response.type || ""
            const state = response.state || ""
            return { results, type, state }
        })
        .catch((error) => {
            const message = (error.message) ? "Could not fetch the process results: " + error.message : "Could not fetch the process results"
            throw new Error(message)
        })
}

/**
 * Fetches the results for a given processId
 * @param processId
 * @param dvoteGateway
 * @returns Results, vote process  type, vote process state
 */
export function getResultsDigest(processId: string, web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<ProcessResults> {
    if (!processId)
        return Promise.reject(new Error("No process ID provided"))
    else if (!(dvoteGateway instanceof DVoteGateway) || !(web3Gateway instanceof Web3Gateway))
        return Promise.reject(new Error("Invalid Gateway object"))

    var voteMetadata: ProcessMetadata
    const pid = processId.startsWith("0x") ? processId : "0x" + processId
    return getVoteMetadata(pid, web3Gateway, dvoteGateway)
        .then((meta) => {
            voteMetadata = meta
            return getRawResults(processId, dvoteGateway)
        }).then(({ results, type, state }) => {
            const resultsDigest: ProcessResults = { questions: [] }
            const zippedQuestions = voteMetadata.details.questions.map((e, i) => ({ meta: e, result: results[i] }))
            resultsDigest.questions = zippedQuestions.map((zippedEntry, idx): ProcessResultItem => {
                const zippedOptions = zippedEntry.meta.voteOptions.map((e, i) => ({ title: e.title, value: zippedEntry.result[i] }))
                return {
                    question: zippedEntry.meta.question,
                    type: voteMetadata.details.questions[idx].type,
                    voteResults: zippedOptions.map((option) => ({
                        title: option.title,
                        votes: option.value || 0,
                    })),
                }
            })
            return resultsDigest
        })
}

// COMPUTATION

// TODO: SEE https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

export function packageSnarkEnvelope(params: {
    votes: number[], merkleProof: string, processId: string, privateKey: string,
    encryptionPublicKey?: string
}): SnarkVoteEnvelope {
    if (!params) throw new Error("Invalid parameters");
    if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
    else if (typeof params.merkleProof != "string" || !params.merkleProof.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid Merkle Proof")
    else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
    else if (!params.privateKey || !params.privateKey.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid private key")
    else if (typeof params.encryptionPublicKey != "undefined") {
        if (typeof params.encryptionPublicKey != "string" || !params.encryptionPublicKey.match(/^(0x)?[0-9a-zA-Z]+$/))
            throw new Error("The encryption public key is not valid")
    }

    // TODO: use packageSnarkVote()
    throw new Error("TODO: unimplemented")
}

/**
 * Packages the given vote array into a JSON payload that can be sent to Vocdoni Gateways.
 * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
 * @param params 
 */
export async function packagePollEnvelope(params: {
    votes: number[], merkleProof: string, processId: string, walletOrSigner: Wallet | Signer,
    encryptionPublicKey?: string
}): Promise<PollVoteEnvelope> {
    if (!params) throw new Error("Invalid parameters");
    else if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
    else if (typeof params.merkleProof != "string" || !params.merkleProof.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid Merkle Proof")
    else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
    else if (!params.walletOrSigner || !params.walletOrSigner.signMessage) throw new Error("Invalid wallet or signer")
    else if (typeof params.encryptionPublicKey != "undefined") {
        if (typeof params.encryptionPublicKey != "string" || !params.encryptionPublicKey.match(/^(0x)?[0-9a-zA-Z]+$/))
            throw new Error("The encryption public key is not valid")
    }

    try {
        const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

        const votePackage: string = packagePollVote(params.votes, params.encryptionPublicKey)

        const pkg: PollVoteEnvelope = {
            processId: params.processId,
            proof: params.merkleProof,
            nonce,
            votePackage
            // signature:  Must be unset because the body must be singed without the  signature
        }

        pkg.signature = await signJsonBody(pkg, params.walletOrSigner)

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
    // const strPayload = JSON.stringify(payload)

    // if (encryptionPublicKey) return Asymmetric.encryptString(strPayload, encryptionPublicKey)
    // else return Buffer.from(strPayload).toString("base64")
    throw new Error("Unimplemented")
}

/**
 * Packages the given votes into a base64 string. If encryptionPublicKey is defined, the base64 payload
 * will be encrypted for it.
 * @param votes An array of numbers with the choices
 * @param encryptionPublicKey An ed25519 public key (https://ed25519.cr.yp.to/)
 */
export function packagePollVote(votes: number[], encryptionPublicKey: string): string {
    if (!Array.isArray(votes)) throw new Error("Invalid votes")
    else if (typeof encryptionPublicKey != "undefined") {
        if (typeof encryptionPublicKey != "string" || !encryptionPublicKey.match(/^(0x)?[0-9a-zA-Z]+$/))
            throw new Error("The encryption public key is not valid")
    }
    const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

    const payload: PollVotePackage = {
        type: "poll-vote",
        nonce,
        votes
    }
    const strPayload = JSON.stringify(payload)

    if (encryptionPublicKey) return Asymmetric.encryptString(strPayload, encryptionPublicKey)
    else return Buffer.from(strPayload).toString("base64")
}

/** Computes the nullifier of the user's vote within a poll voting process.
* Returns a hex string with kecak256(bytes(address) + bytes(processId))
*/
export function getPollNullifier(address: string, processId: string): string {
    address = address.replace(/^0x/, "")
    processId = processId.replace(/^0x/, "")

    if (address.length != 40) return null
    else if (processId.length != 64) return null

    return utils.keccak256(utils.arrayify("0x" + address + processId))
}


// TYPES

// SNARK
export type SnarkVoteEnvelope = {
    processId: string,
    proof: string,  // ZK Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    nullifier: string,   // Hash of the private key
    votePackage: string  // base64(jsonString) is encrypted
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
    votePackage: string,  // base64(json(votePackage))
    signature?: string //  Signature including all the rest of the envelope (processId, proof, nonce, votePackage)
}
export type PollVotePackage = {
    type: "poll-vote",
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Directly mapped to the `questions` field of the metadata
}
