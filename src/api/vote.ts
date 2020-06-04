import { Wallet, Signer, utils } from "ethers"
import { Gateway, IGateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata, ProcessResults, ProcessType, VochainProcessState, ProcessResultItem } from "../models/voting-process"
// import { HexString } from "../models/common"
import ContentHashedURI from "../wrappers/content-hashed-uri"
import { getEntityMetadataByAddress, updateEntity, getEntityId } from "./entity"
import { VOCHAIN_BLOCK_TIME } from "../constants"
import { signJsonBody } from "../util/json-sign"
import { Buffer } from "buffer/"  // Previously using "arraybuffer-to-string"
import { Asymmetric } from "../util/encryption"
import { GatewayPool, IGatewayPool } from "../net/gateway-pool"
import { waitVochainBlocks } from "../util/waiters"

type IProcessKeys = {
    encryptionPubKeys: { idx: number, key: string }[],
    encryptionPrivKeys?: { idx: number, key: string }[],
    commitmentKeys?: { idx: number, key: string }[],
    revealKeys?: { idx: number, key: string }[]
}

/**
 * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
 * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
 * @param processMetadata JSON object containing the schema defined on  https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 * @param walletOrSigner
 * @param gateway
 * @returns The process ID
 */
export async function createVotingProcess(processMetadata: ProcessMetadata,
    walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
    if (!processMetadata) return Promise.reject(new Error("Invalid process metadata"))
    else if (!walletOrSigner || !(walletOrSigner instanceof Wallet || walletOrSigner instanceof Signer))
        return Promise.reject(new Error("Invalid Wallet or Signer"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool))
        return Promise.reject(new Error("Invalid Gateway object"))

    // throw if not valid
    processMetadata = checkValidProcessMetadata(processMetadata)
    const merkleRoot = processMetadata.census.merkleRoot
    const merkleTree = new ContentHashedURI(processMetadata.census.merkleTree)

    try {
        const processInstance = gateway.getVotingProcessInstance(walletOrSigner)

        const address = await walletOrSigner.getAddress()

        // CHECK THAT THE ENTITY EXISTS
        const entityMeta = await getEntityMetadataByAddress(address, gateway)
        if (!entityMeta) return Promise.reject(new Error("The entity is not yet registered on the blockchain"))
        else if (getEntityId(address) != processMetadata.details.entityId)
            return Promise.reject(new Error("The EntityId on the metadata does not match the given wallet's address"))

        // UPLOAD THE METADATA
        const strJsonMeta = JSON.stringify(processMetadata)
        const processMetaOrigin = await addFile(strJsonMeta, `merkle-root-${merkleRoot}.json`, walletOrSigner, gateway)
        if (!processMetaOrigin) return Promise.reject(new Error("The process metadata could not be uploaded"))

        // REGISTER THE NEW PROCESS
        const tx = await processInstance.create(processMetadata.type, processMetaOrigin, merkleRoot, merkleTree.toContentUriString(),
            processMetadata.startBlock, processMetadata.numberOfBlocks)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()

        const count = await processInstance.getEntityProcessCount(address)
        if (!count || count.isZero()) return Promise.reject(new Error("The process could not be created"))
        const processId = await processInstance.getProcessId(address, count.toNumber() - 1)

        // UPDATE THE ENTITY
        if (!entityMeta.votingProcesses) entityMeta.votingProcesses = { active: [], ended: [] }
        entityMeta.votingProcesses.active = [processId].concat(entityMeta.votingProcesses.active || [])

        await updateEntity(address, entityMeta, walletOrSigner, gateway)

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
export async function getVoteMetadata(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessMetadata> {
    if (!processId) throw new Error("Invalid processId")
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    const processInstance = await gateway.getVotingProcessInstance()

    try {
        const processInfo = await processInstance.get(processId)
        if (!processInfo.metadata) throw new Error("The given voting process has no metadata")

        const jsonBuffer = await fetchFileString(processInfo.metadata, gateway)

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
export function getVotesMetadata(processIds: string[], gateway: IGateway | IGatewayPool): Promise<ProcessMetadata[]> {
    if (!Array.isArray(processIds)) return Promise.reject(new Error("Invalid processId"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return Promise.all(processIds.map((id) => getVoteMetadata(id, gateway)))
}

/**
 * Send a transaction to mark a voting process as canceled or ended.
 * @param processId
 * @param walletOrSigner
 * @param web3Gateway
 */
export async function cancelProcess(processId: string,
    walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getVotingProcessInstance(walletOrSigner)

        const tx = await processInstance.cancel(processId)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Checks wether the given process is canceled or not.
 * @param processId
 * @param web3Gateway
 */
export async function isCanceled(processId: string, gateway: IGateway | IGatewayPool): Promise<boolean> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getVotingProcessInstance()

        const processInfo = await processInstance.get(processId)
        if (!processInfo) throw new Error("Could not check the process status")
        return !!processInfo.canceled
    }
    catch (err) {
        throw err
    }
}

/**
 * Retrieves the number of blocks on the Vochain
 * @param gateway
 */
export function getBlockHeight(gateway: IGateway | IGatewayPool): Promise<number> {
    if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

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
 * Retrieves the encryption public keys of the given process
 * @param processId
 * @param gateway
 */
export function getProcessKeys(processId: string, gateway: IGateway | IGatewayPool): Promise<IProcessKeys> {
    if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getProcessKeys", processId })
        .then((response) => {
            if (!response) throw new Error("The gateway response is not correct")
            const result: IProcessKeys = { encryptionPubKeys: [], encryptionPrivKeys: [], commitmentKeys: [], revealKeys: [] }
            if (Array.isArray(response.encryptionPubKeys) && response.encryptionPubKeys.every(item => typeof item.idx == "number" && typeof item.key == "string"))
                result.encryptionPubKeys = response.encryptionPubKeys
            if (Array.isArray(response.encryptionPrivKeys) && response.encryptionPrivKeys.every(item => typeof item.idx == "number" && typeof item.key == "string"))
                result.encryptionPrivKeys = response.encryptionPrivKeys
            if (Array.isArray(response.commitmentKeys) && response.commitmentKeys.every(item => typeof item.idx == "number" && typeof item.key == "string"))
                result.commitmentKeys = response.commitmentKeys
            if (Array.isArray(response.revealKeys) && response.revealKeys.every(item => typeof item.idx == "number" && typeof item.key == "string"))
                result.revealKeys = response.revealKeys
            return result
        })
        .catch((error) => {
            const message = (error.message) ? "Could not retrieve the process encryption keys: " + error.message : "Could not retrieve the process encryption keys"
            throw new Error(message)
        })
}

/**
 * Submit the vote envelope to a Gateway
 * @param voteEnvelope
 * @param gateway
 */
export async function submitEnvelope(voteEnvelope: SnarkVoteEnvelope | PollVoteEnvelope, gateway: IGateway | GatewayPool): Promise<void> {
    if (!voteEnvelope) return Promise.reject(new Error("Invalid parameters"))
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "submitEnvelope", payload: voteEnvelope })
        .catch((error) => {
            const message = (error.message) ? "Could not submit the vote envelope: " + error.message : "Could not submit the vote envelope"
            throw new Error(message)
        })
}

/**
 * Get status of an envelope
 * @param processId
 * @param nullifier
 * @param gateway
 */
export function getEnvelopeStatus(processId: string, nullifier: string, gateway: IGateway | IGatewayPool): Promise<{ registered: boolean, date?: Date, block?: number }> {
    if (!processId || !nullifier) return Promise.reject(new Error("Invalid parameters"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelopeStatus", processId, nullifier })
        .then((response) => {
            if (response.registered === true) {
                if (typeof response.blockTimestamp != "number") throw new Error("Invalid response received from the gateway")
                return {
                    registered: response.registered,
                    date: new Date(response.blockTimestamp * 1000),
                    block: response.height
                }
            }

            return { registered: false }
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
export async function getEnvelope(processId: string, gateway: IGateway | IGatewayPool, nullifier: string): Promise<string> {
    if (!processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelope", nullifier, processId })
        .then((response) => {
            if (!response.payload) throw new Error("The envelope could not be retrieved")
            // if (!(response.payload instanceof String)) return Promise.reject(new Error("Envlope content not correct"))
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
export function getEnvelopeHeight(processId: string, gateway: IGateway | IGatewayPool): Promise<number> {
    if (!processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getEnvelopeHeight", processId })
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
export function getTimeUntilStart(processId: string, startBlock: number, gateway: IGateway | IGatewayPool): Promise<number> {
    if (!processId || isNaN(startBlock)) return Promise.reject(new Error("Invalid parameters"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(gateway).then((currentHeight) => {
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
export function getTimeUntilEnd(processId: string, startBlock: number, numberOfBlocks: number, gateway: IGateway | IGatewayPool): Promise<number> {
    if (!processId || isNaN(startBlock) || isNaN(numberOfBlocks)) return Promise.reject(new Error("Invalid parameters"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(gateway).then((currentHeight) => {
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
export function getTimeForBlock(processId: string, blockNumber: number, gateway: IGateway | IGatewayPool): Promise<Date> {
    if (!processId || isNaN(blockNumber)) return Promise.reject(new Error("Invalid parameters"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(gateway)
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
export function getBlockNumberForTime(processId: string, dateTime: Date, gateway: IGateway | IGatewayPool): Promise<number> {
    if (!processId || !(dateTime instanceof Date)) return Promise.reject(new Error("Invalid parameters"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return getBlockHeight(gateway)
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
 * Fetches the list of process ID's for a given entity
 * @param entityId
 * @param gateway
 * @param afterId (optional) Skip any process ID's before this one and itself too
 */
export async function getProcessList(entityId: string, gateway: IGateway | IGatewayPool, afterId?: string): Promise<string[]> {
    if (!entityId) throw new Error("Invalid Entity Id")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const req: any = {
            method: "getProcessList",
            entityId
        }
        if (afterId) req.fromId = afterId

        const response = await gateway.sendMessage(req)
        if (!response || !Array.isArray(response.processList)) throw new Error("Invalid response")
        return response.processList
    }
    catch (err) {
        throw err
    }
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
    from: number, listSize: number, gateway: IGateway | IGatewayPool): Promise<string[]> {
    if (!processId || isNaN(from) || isNaN(listSize) || !gateway)
        return Promise.reject(new Error("Invalid parameters"))

    return gateway.sendMessage({ method: "getEnvelopeList", processId, from, listSize })
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
 * @param gateway
 * @returns Results, vote process  type, vote process state
 */
export function getRawResults(processId: string, gateway: IGateway | IGatewayPool): Promise<{ results: number[][], type: ProcessType, state: VochainProcessState }> {
    if (!gateway || !processId)
        return Promise.reject(new Error("No process ID provided"))
    else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
        return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendMessage({ method: "getResults", processId })
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
 * Fetches the results for a given processId.
 * @param processId
 * @param gateway
 * @returns Results, vote process  type, vote process state
 */
export async function getResultsDigest(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessResults> {
    if (!processId)
        throw new Error("No process ID provided")
    else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
        throw new Error("Invalid Gateway object")

    const pid = processId.startsWith("0x") ? processId : "0x" + processId
    try {
        const voteMetadata = await getVoteMetadata(pid, gateway)

        // Encrypted?
        let procKeys: IProcessKeys, retries: number
        const currentBlock = await getBlockHeight(gateway)
        switch (voteMetadata.type) {
            case "encrypted-poll":
                if (currentBlock < voteMetadata.startBlock) return { questions: [] }
                else if ((currentBlock < (voteMetadata.startBlock + voteMetadata.numberOfBlocks)) && !(await isCanceled(processId, gateway))) return { questions: [] }

                retries = 3
                do {
                    procKeys = await getProcessKeys(processId, gateway)
                    if (procKeys && procKeys.encryptionPrivKeys && procKeys.encryptionPrivKeys.length) break

                    await waitVochainBlocks(2, gateway)
                    retries--
                } while (retries >= 0)
                if (!procKeys || !procKeys.encryptionPrivKeys || !procKeys.encryptionPrivKeys.length) return { questions: [] }

                break
            default:
        }

        const { results, type, state } = await getRawResults(processId, gateway)

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
    }
    catch (err) {
        throw new Error("The results are not available")
    }
}

// COMPUTATION

// TODO: SEE https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

export function packageSnarkEnvelope(params: {
    votes: number[], merkleProof: string, processId: string, privateKey: string,
    processKeys?: IProcessKeys
}): SnarkVoteEnvelope {
    if (!params) throw new Error("Invalid parameters");
    if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
    else if (typeof params.merkleProof != "string" || !params.merkleProof.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid Merkle Proof")
    else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
    else if (!params.privateKey || !params.privateKey.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid private key")
    else if (params.processKeys) {
        if (!Array.isArray(params.processKeys.encryptionPubKeys) || !params.processKeys.encryptionPubKeys.every(
            item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
            throw new Error("Some encryption public keys are not valid")
        }
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
    processKeys?: IProcessKeys
}): Promise<PollVoteEnvelope> {
    if (!params) throw new Error("Invalid parameters");
    else if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
    else if (typeof params.merkleProof != "string" || !params.merkleProof.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid Merkle Proof")
    else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
    else if (!params.walletOrSigner || !params.walletOrSigner.signMessage) throw new Error("Invalid wallet or signer")
    else if (params.processKeys) {
        if (!Array.isArray(params.processKeys.encryptionPubKeys) || !params.processKeys.encryptionPubKeys.every(
            item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
            throw new Error("Some encryption public keys are not valid")
        }
    }

    try {
        const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

        const { votePackage, keyIndexes } = packagePollVote(params.votes, params.processKeys)

        const pkg: PollVoteEnvelope = {
            processId: params.processId,
            proof: params.merkleProof,
            nonce,
            votePackage
            // signature:  Must be unset because the body must be singed without the  signature
        }
        if (keyIndexes) pkg.encryptionKeyIndexes = keyIndexes

        pkg.signature = await signJsonBody(pkg, params.walletOrSigner)

        return pkg
    } catch (error) {
        throw new Error("Poll vote Envelope could not be generated")
    }
}

export function packageSnarkVote(votes: number[], processKeys?: IProcessKeys): { votePackage: string, keyIndexes?: number[] } {
    // if (!Array.isArray(votes)) throw new Error("Invalid votes")
    // else if (processKeys) {
    //     if (!Array.isArray(processKeys.encryptionPubKeys) || !processKeys.encryptionPubKeys.every(
    //         item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
    //         throw new Error("Some encryption public keys are not valid")
    //     }
    // }
    // const nonce = utils.keccak256('0x' + Date.now().toString(16)).substr(2)

    // const payload: SnarkVotePackage = {
    //     type: "snark-vote",
    //     nonce,
    //     votes
    // }

    // // TODO: ENCRYPT WITH processKeys.encryptionPubKeys
    // const strPayload = JSON.stringify(payload)

    // if (encryptionPubKeys) return Asymmetric.encryptString(strPayload, processKeys.encryptionPubKeys)
    // else return Buffer.from(strPayload).toString("base64")
    throw new Error("Unimplemented")
}

/**
 * Packages the given votes into a base64 string. If encryptionPubKeys is defined, the base64 payload
 * will be encrypted for it.
 * @param votes An array of numbers with the choices
 * @param encryptionPubKeys An ed25519 public key (https://ed25519.cr.yp.to/)
 */
export function packagePollVote(votes: number[], processKeys?: IProcessKeys): { votePackage: string, keyIndexes?: number[] } {
    if (!Array.isArray(votes)) throw new Error("Invalid votes")
    else if (processKeys) {
        if (!Array.isArray(processKeys.encryptionPubKeys) || !processKeys.encryptionPubKeys.every(
            item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
            throw new Error("Some encryption public keys are not valid")
        }
    }

    // produce a 8 byte nonce
    const nonceSeed = utils.arrayify('0x' + parseInt(Math.random().toString().substr(2)).toString(16) + parseInt(Math.random().toString().substr(2)).toString(16) + Date.now().toString(16))
    const nonce = utils.keccak256(nonceSeed).substr(2, 16)

    const payload: PollVotePackage = {
        type: "poll-vote",
        nonce,
        votes
    }
    const strPayload = JSON.stringify(payload)

    if (processKeys && processKeys.encryptionPubKeys && processKeys.encryptionPubKeys.length) {
        // Sort key indexes
        processKeys.encryptionPubKeys.sort((a, b) => a.idx - b.idx)

        const publicKeys: string[] = []
        const publicKeysIdx: number[] = []
        // NOTE: Using all keys by now
        processKeys.encryptionPubKeys.forEach(entry => {
            publicKeys.push(entry.key.replace(/^0x/, ""))
            publicKeysIdx.push(entry.idx)
        })

        let buff: Buffer
        for (let i = 0; i < publicKeys.length; i++) {
            if (i > 0) buff = Asymmetric.encryptRaw(buff, publicKeys[i]) // reencrypt buff
            else buff = Asymmetric.encryptRaw(Buffer.from(strPayload), publicKeys[i]) // encrypt the first
        }
        const result = buff.toString("base64")
        return { votePackage: result, keyIndexes: publicKeysIdx }
    }
    else {
        return { votePackage: Buffer.from(strPayload).toString("base64") }
    }
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
    encryptionKeyIndexes?: number[],   // The index of the keys used to encrypt the votePackage (only for encrypted processes)
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
    encryptionKeyIndexes?: number[],   // The index of the keys used to encrypt the votePackage (only for encrypted processes)
    votePackage: string,  // base64(json(votePackage))
    signature?: string //  Signature including all the rest of the envelope (processId, proof, nonce, votePackage)
}
export type PollVotePackage = {
    type: "poll-vote",
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Directly mapped to the `questions` field of the metadata
}
