import { Wallet, Signer, utils, ContractTransaction } from "ethers"
import { Gateway, IGateway } from "../net/gateway"
import { fetchFileString, addFile } from "./file"
import { ProcessMetadata, checkValidProcessMetadata, ProcessResults, ProcessResultItem, INewProcessParams } from "../models/process"
// import { HexString } from "../models/common"
import { setMetadata, getEntityMetadata } from "./entity"
import { VOCHAIN_BLOCK_TIME, XDAI_GAS_PRICE, XDAI_CHAIN_ID, SOKOL_CHAIN_ID, SOKOL_GAS_PRICE } from "../constants"
import { signJsonBody } from "../util/json-sign"
import { Buffer } from "buffer/"  // Previously using "arraybuffer-to-string"
import { Asymmetric } from "../util/encryption"
import { GatewayPool, IGatewayPool } from "../net/gateway-pool"
import { waitVochainBlocks } from "../util/waiters"
import { IMethodOverrides, ProcessStatus, ProcessContractParameters, IProcessCreateParams, IProcessStatus } from "dvote-solidity"

export { ProcessStatus, ProcessContractParameters, IProcessStatus } from "dvote-solidity"

type IProcessKeys = {
    encryptionPubKeys: { idx: number, key: string }[],
    encryptionPrivKeys?: { idx: number, key: string }[],
    commitmentKeys?: { idx: number, key: string }[],
    revealKeys?: { idx: number, key: string }[]
}

///////////////////////////////////////////////////////////////////////////////
// CONTRACT GETTERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Compute the process ID of an Entity at a given index and namespace
 * @param entityAddress
 * @param processCountIndex
 * @param namespace
 */
export function getProcessId(entityAddress: string, processCountIndex: number, namespace: number): string {
    if (!entityAddress) throw new Error("Invalid address")

    return utils.keccak256(
        utils.solidityPack(["address", "uint256", "uint16"], [entityAddress, processCountIndex, namespace])
    )
}

/**
 * Fetch the raw parameters for the given processId using the given gateway
 * @param processId
 * @param gateway
 */
export function getProcessParameters(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessContractParameters> {
    if (!processId) throw new Error("Invalid processId")
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.getProcessInstance()
        .then(processInstance => processInstance.get(processId))
        .then(params => ProcessContractParameters.fromContract(params))
        .catch(error => {
            const message = (error.message) ? "Could not fetch the process data: " + error.message : "Could not fetch the process data"
            throw new Error(message)
        })
}

/**
 * Fetch the JSON metadata for the given processId using the given gateway
 * @param processId
 * @param gateway
 */
export async function getProcessMetadata(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessMetadata> {
    if (!processId) throw new Error("Invalid processId")
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    try {
        const processParams = await getProcessParameters(processId, gateway)
        if (!processParams.metadata) throw new Error("The given voting process has no metadata")

        const jsonBuffer = await fetchFileString(processParams.metadata, gateway)

        return JSON.parse(jsonBuffer.toString())
    } catch (error) {
        const message = (error.message) ? "Could not fetch the process data: " + error.message : "Could not fetch the process data"
        throw new Error(message)
    }
}

/**
 * Retrieves the number of blocks on the Vochain
 * @param gateway
 */
export function getBlockHeight(gateway: IGateway | IGatewayPool): Promise<number> {
    return getBlockStatus(gateway)
        .then(status => {
            if (!(typeof status.blockNumber === 'number') || status.blockNumber < 0) throw new Error("The retrieved block number is not valid")
            return status.blockNumber
        })
        .catch((error) => {
            const message = error.message ? "Could not retrieve the number of blocks: " + error.message : "Could not retrieve the number of blocks"
            throw new Error(message)
        })
}

/**
 * Retrieves the current block number, the timestamp at which the block was mined and the average block time in miliseconds for 1m, 10m, 1h, 6h and 24h.
 * @param gateway
 * @see estimateBlockAtDateTime (date, gateway)
 * @see estimateDateAtBlock (blockNumber, gateway)
 */
export function getBlockStatus(gateway: IGateway | IGatewayPool): Promise<{ blockNumber: number, blockTimestamp: number, blockTimes: number[] }> {
    if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendRequest({ method: "getBlockStatus" })
        .then((response) => {
            if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The block height is not valid")
            else if (!(typeof response.blockTimestamp === 'number') || response.blockTimestamp < 0) throw new Error("The block timestamp is not valid")
            else if (!Array.isArray(response.blockTime) || response.blockTime.some(item => typeof item != "number" || item < 0)) throw new Error("The block times are not valid")

            return {
                blockNumber: response.height,
                blockTimestamp: response.blockTimestamp * 1000,
                blockTimes: response.blockTime
            }
        })
        .catch((error) => {
            const message = error.message ? "Could not retrieve the block status: " + error.message : "Could not retrieve the block status"
            throw new Error(message)
        })
}

/**
 * Returns the block number that is expected to be current at the given date and time
 * @param dateTime
 * @param gateway
 */
export function estimateBlockAtDateTime(dateTime: Date, gateway: IGateway | IGatewayPool): Promise<number> {
    if (typeof dateTime == "number") dateTime = new Date(dateTime)
    if (!(dateTime instanceof Date)) return null

    return getBlockStatus(gateway).then(status => {
        let averageBlockTime = VOCHAIN_BLOCK_TIME * 1000
        let weightA: number, weightB: number

        // Diff between the last mined block and the given date
        const dateDiff = Math.abs(dateTime.getTime() - status.blockTimestamp)

        // status.blockTime => [1m, 10m, 1h, 6h, 24h]

        if (dateDiff >= 1000 * 60 * 60 * 24) {
            if (status.blockTimes[4] > 0) averageBlockTime = status.blockTimes[4]
            else if (status.blockTimes[3] > 0) averageBlockTime = status.blockTimes[3]
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 60 * 6) {
            // 1000 * 60 * 60 * 6 <= dateDiff < 1000 * 60 * 60 * 24
            if (status.blockTimes[4] > 0 && status.blockTimes[3] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 60 * 6) / (1000 * 60 * 60)
                weightB = pivot / (24 - 6) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * status.blockTimes[3] + weightB * status.blockTimes[4]
            }
            else if (status.blockTimes[3] > 0) averageBlockTime = status.blockTimes[3]
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 60) {
            // 1000 * 60 * 60 <= dateDiff < 1000 * 60 * 60 * 6
            if (status.blockTimes[3] > 0 && status.blockTimes[2] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 60) / (1000 * 60 * 60)
                weightB = pivot / (6 - 1) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * status.blockTimes[2] + weightB * status.blockTimes[3]
            }
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 10) {
            // 1000 * 60 * 10 <= dateDiff < 1000 * 60 * 60
            if (status.blockTimes[2] > 0 && status.blockTimes[1] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 10) / (1000 * 60)
                weightB = pivot / (60 - 10) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * status.blockTimes[1] + weightB * status.blockTimes[2]
            }
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60) {
            // 1000 * 60 <= dateDiff < 1000 * 60 * 6
            const pivot = (dateDiff - 1000 * 60) / (1000 * 60)
            weightB = pivot / (10 - 1) // 0..1
            weightA = 1 - weightB

            if (status.blockTimes[1] > 0 && status.blockTimes[0] > 0) {
                averageBlockTime = weightA * status.blockTimes[0] + weightB * status.blockTimes[1]
            }
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else {
            if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }

        const estimatedBlockDiff = dateDiff / averageBlockTime
        const estimatedBlock = dateTime.getTime() < status.blockTimestamp ?
            status.blockNumber - Math.ceil(estimatedBlockDiff) :
            status.blockNumber + Math.floor(estimatedBlockDiff)

        if (estimatedBlock < 0) return 0
        return estimatedBlock
    })
}

const blocksPerM = 60 / VOCHAIN_BLOCK_TIME
const blocksPer10m = 10 * blocksPerM
const blocksPerH = blocksPerM * 60
const blocksPer6h = 6 * blocksPerH
const blocksPerDay = 24 * blocksPerH

/**
 * Returns the DateTime at which the given block number is expected to be mined
 * @param blockNumber
 * @param gateway
 */
export function estimateDateAtBlock(blockNumber: number, gateway: IGateway | IGatewayPool): Promise<Date> {
    if (!blockNumber) return null

    return getBlockStatus(gateway).then(status => {
        // Diff between the last mined block and the given one
        const blockDiff = Math.abs(blockNumber - status.blockNumber)
        let averageBlockTime = VOCHAIN_BLOCK_TIME * 1000
        let weightA: number, weightB: number

        // status.blockTime => [1m, 10m, 1h, 6h, 24h]
        if (blockDiff > blocksPerDay) {
            if (status.blockTimes[4] > 0) averageBlockTime = status.blockTimes[4]
            else if (status.blockTimes[3] > 0) averageBlockTime = status.blockTimes[3]
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (blockDiff > blocksPer6h) {
            // blocksPer6h <= blockDiff < blocksPerDay
            const pivot = (blockDiff - blocksPer6h) / (blocksPerH)
            weightB = pivot / (24 - 6) // 0..1
            weightA = 1 - weightB

            if (status.blockTimes[4] > 0 && status.blockTimes[3] > 0) {
                averageBlockTime = weightA * status.blockTimes[3] + weightB * status.blockTimes[4]
            }
            else if (status.blockTimes[3] > 0) averageBlockTime = status.blockTimes[3]
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (blockDiff > blocksPerH) {
            // blocksPerH <= blockDiff < blocksPer6h
            const pivot = (blockDiff - blocksPerH) / (blocksPerH)
            weightB = pivot / (6 - 1) // 0..1
            weightA = 1 - weightB

            if (status.blockTimes[3] > 0 && status.blockTimes[2] > 0) {
                averageBlockTime = weightA * status.blockTimes[2] + weightB * status.blockTimes[3]
            }
            else if (status.blockTimes[2] > 0) averageBlockTime = status.blockTimes[2]
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (blockDiff > blocksPer10m) {
            // blocksPer10m <= blockDiff < blocksPerH
            const pivot = (blockDiff - blocksPer10m) / (blocksPerM)
            weightB = pivot / (60 - 10) // 0..1
            weightA = 1 - weightB

            if (status.blockTimes[2] > 0 && status.blockTimes[1] > 0) {
                averageBlockTime = weightA * status.blockTimes[1] + weightB * status.blockTimes[2]
            }
            else if (status.blockTimes[1] > 0) averageBlockTime = status.blockTimes[1]
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else if (blockDiff > blocksPerM) {
            // blocksPerM <= blockDiff < blocksPer10m
            const pivot = (blockDiff - blocksPerM) / (blocksPerM)
            weightB = pivot / (10 - 1) // 0..1
            weightA = 1 - weightB

            if (status.blockTimes[1] > 0 && status.blockTimes[0] > 0) {
                averageBlockTime = weightA * status.blockTimes[0] + weightB * status.blockTimes[1]
            }
            else if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }
        else {
            if (status.blockTimes[0] > 0) averageBlockTime = status.blockTimes[0]
        }

        const targetTimestamp = status.blockTimestamp + (blockNumber - status.blockNumber) * averageBlockTime
        return new Date(targetTimestamp)
    })
}

/**
 * Retrieves the encryption public keys of the given process
 * @param processId
 * @param gateway
 */
export function getProcessKeys(processId: string, gateway: IGateway | IGatewayPool): Promise<IProcessKeys> {
    if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendRequest({ method: "getProcessKeys", processId })
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

///////////////////////////////////////////////////////////////////////////////
// CONTRACT SETTERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
 * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
 * @param parameters The details sent to the smart contract, except the metadata origin  https://vocdoni.io/docs/#/architecture/components/process?id=internal-structs
 * @param metadata The human readable content displayed on the clients https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 * @param walletOrSigner
 * @param gateway
 * @returns The process ID
 */
export async function newProcess(processParameters: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata },
    walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
    if (!processParameters) return Promise.reject(new Error("Invalid process metadata"))
    else if (!processParameters.metadata) return Promise.reject(new Error("Invalid process metadata"))
    else if (!walletOrSigner || !(walletOrSigner instanceof Wallet || walletOrSigner instanceof Signer))
        return Promise.reject(new Error("Invalid Wallet or Signer"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool))
        return Promise.reject(new Error("Invalid Gateway object"))

    // Merge parameters and metadata, by now
    const questionCount = processParameters.metadata.questions.length
    const contractParameters = ProcessContractParameters.fromParams({ ...processParameters, questionCount, metadata: "" })

    // throw if not valid
    const metadata = checkValidProcessMetadata(processParameters.metadata)

    try {
        const processInstance = gateway.getProcessInstance(walletOrSigner)

        const address = await walletOrSigner.getAddress()

        // CHECK THAT THE ENTITY EXISTS
        const entityMetadata = await getEntityMetadata(address, gateway)
        if (!entityMetadata) return Promise.reject(new Error("The entity is not yet registered on the blockchain"))

        // UPLOAD THE METADATA
        const strJsonMeta = JSON.stringify(metadata)
        const processMetaOrigin = await addFile(strJsonMeta, `process-metadata.json`, walletOrSigner, gateway)
        if (!processMetaOrigin) return Promise.reject(new Error("The process metadata could not be uploaded"))

        // SET METADATA IN PARAMS
        contractParameters.metadata = processMetaOrigin

        // REGISTER THE NEW PROCESS
        const chainId = await gateway.getChainId()
        let options: IMethodOverrides
        let tx: ContractTransaction
        switch (chainId) {
            case XDAI_CHAIN_ID:
                options = { gasPrice: XDAI_GAS_PRICE }
                tx = await processInstance.newProcess(...contractParameters.toContractParams(options))
                break
            case SOKOL_CHAIN_ID:
                const addr = await walletOrSigner.getAddress()
                const nonce = await walletOrSigner.provider.getTransactionCount(addr)
                options = {
                    gasPrice: SOKOL_GAS_PRICE,
                    nonce,
                }
                tx = await processInstance.newProcess(...contractParameters.toContractParams(options))
                break
            default:
                tx = await processInstance.newProcess(...contractParameters.toContractParams())
        }

        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()

        const count = await processInstance.getEntityProcessCount(address)
        if (!count || count.isZero()) return Promise.reject(new Error("The process could not be created"))
        const processId = await processInstance.getProcessId(address, count.toNumber() - 1, contractParameters.namespace)

        // UPDATE THE ENTITY
        if (!entityMetadata.votingProcesses) entityMetadata.votingProcesses = { active: [], ended: [] }
        entityMetadata.votingProcesses.active = [processId].concat(entityMetadata.votingProcesses.active || [])

        await setMetadata(address, entityMetadata, walletOrSigner, gateway)

        return processId
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Send a transaction to update the status of a process. NOTE: `INTERRUPTIBLE` needs to be enabled or the process has to be PAUSED, after creation.
 * @param processId
 * @param newStatus
 * @param walletOrSigner
 * @param web3Gateway
 */
export async function setStatus(processId: string, newStatus: IProcessStatus, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getProcessInstance(walletOrSigner)

        const tx = await processInstance.setStatus(processId, newStatus)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Send a transaction to increment the questionIndex of a process. NOTE: `SERIAL` needs to be enabled.
 * @param processId
 * @param newStatus
 * @param walletOrSigner
 * @param web3Gateway
 */
export async function incrementQuestionIndex(processId: string, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getProcessInstance(walletOrSigner)

        const tx = await processInstance.incrementQuestionIndex(processId)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Send a transaction to update the census details of a process. NOTE: `DYNAMIC_CENSUS` needs to be enabled.
 * @param processId
 * @param newStatus
 * @param walletOrSigner
 * @param web3Gateway
 */
export async function setCensus(processId: string, censusMerkleRoot: string, censusMerkleTree: string, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getProcessInstance(walletOrSigner)

        const tx = await processInstance.setCensus(processId, censusMerkleRoot, censusMerkleTree)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

/**
 * Send a transaction to update the census details of a process. NOTE: the wallet needs to be authorized as an oracle on the namespace of the process.
 * @param processId
 * @param newStatus
 * @param walletOrSigner
 * @param web3Gateway
 */
export async function setResults(processId: string, results: string, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
    if (!processId) throw new Error("Invalid process ID")
    else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

    try {
        const processInstance = await gateway.getProcessInstance(walletOrSigner)

        const tx = await processInstance.setResults(processId, results)
        if (!tx) throw new Error("Could not start the blockchain transaction")
        await tx.wait()
    }
    catch (err) {
        console.error(err)
        throw err
    }
}

///////////////////////////////////////////////////////////////////////////////
// VOCHAIN GETTERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Fetches the vote envelope for a given processId
 * @param processId
 * @param gateway
 * @param nullifier
 */
export async function getEnvelope(processId: string, gateway: IGateway | IGatewayPool, nullifier: string): Promise<string> {
    if (!processId) return Promise.reject(new Error("No process ID provided"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendRequest({ method: "getEnvelope", nullifier, processId })
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

    return gateway.sendRequest({ method: "getEnvelopeHeight", processId })
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

        const response = await gateway.sendRequest(req)
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

    return gateway.sendRequest({ method: "getEnvelopeList", processId, from, listSize })
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
export function getRawResults(processId: string, gateway: IGateway | IGatewayPool): Promise<{ results: number[][], status: ProcessStatus }> {
    if (!gateway || !processId)
        return Promise.reject(new Error("No process ID provided"))
    else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
        return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendRequest({ method: "getResults", processId })
        .then((response) => {
            if (!Array.isArray(response.results)) throw new Error("The gateway response is not valid")
            const results = (Array.isArray(response.results) && response.results.length) ? response.results : []
            const status = response.state || ""
            return { results, status }
        })
        .catch((error) => {
            const message = (error.message) ? "Could not fetch the process results: " + error.message : "Could not fetch the process results"
            throw new Error(message)
        })
}

/**
 * Fetches the results for a given processId and arranges them with the titles and their respective options.
 * @param processId
 * @param gateway
 * @returns Results, vote process  type, vote process state
 */
export async function getResultsDigest(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessResults> {
    if (!processId)
        throw new Error("No process ID provided")
    else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
        throw new Error("Invalid Gateway object")

    processId = processId.startsWith("0x") ? processId : "0x" + processId
    try {
        const processState = await getProcessParameters(processId, gateway)
        if (processState.status.isCanceled) return { questions: [] }

        // Encrypted?
        let procKeys: IProcessKeys, retries: number
        const currentBlock = await getBlockHeight(gateway)
        if (processState.envelopeType.hasEncryptedVotes) {
            if (currentBlock < processState.startBlock) return { questions: [] } // not started
            else if (processState.mode.isInterruptible) {
                if (!processState.status.hasResults && !processState.status.isEnded &&
                    (currentBlock < (processState.startBlock + processState.blockCount))) return { questions: [] } // not ended
            } else {
                if (!processState.status.hasResults &&
                    (currentBlock < (processState.startBlock + processState.blockCount))) return { questions: [] } // not ended
            }

            retries = 3
            do {
                procKeys = await getProcessKeys(processId, gateway)
                if (procKeys && procKeys.encryptionPrivKeys && procKeys.encryptionPrivKeys.length) break

                await waitVochainBlocks(2, gateway)
                retries--
            } while (retries >= 0)
            if (!procKeys || !procKeys.encryptionPrivKeys || !procKeys.encryptionPrivKeys.length) return { questions: [] }
        }

        const { results, status } = await getRawResults(processId, gateway)
        const metadata = await getProcessMetadata(processId, gateway)

        const resultsDigest: ProcessResults = { questions: [] }
        const zippedQuestions = metadata.questions.map((e, i) => ({ meta: e, result: results[i] }))
        resultsDigest.questions = zippedQuestions.map((zippedEntry, idx): ProcessResultItem => {
            const zippedOptions = zippedEntry.meta.choices.map((e, i) => ({ title: e.title, value: zippedEntry.result[i] }))
            return {
                title: zippedEntry.meta.title,
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

///////////////////////////////////////////////////////////////////////////////
// VOCHAIN METHODS
///////////////////////////////////////////////////////////////////////////////

/**
 * Submit the vote envelope to a Gateway
 * @param voteEnvelope
 * @param gateway
 */
export async function submitEnvelope(voteEnvelope: IAnonymousVoteEnvelope | ISignedVoteEnvelope, gateway: IGateway | GatewayPool): Promise<void> {
    if (!voteEnvelope) return Promise.reject(new Error("Invalid parameters"))
    else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    return gateway.sendRequest({ method: "submitEnvelope", payload: voteEnvelope })
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

    return gateway.sendRequest({ method: "getEnvelopeStatus", processId, nullifier })
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

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////

// TODO: SEE https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

/**
 * Packages the given vote array into a JSON payload that can be sent to Vocdoni Gateways.
 * The voter's signature will be included on the vote, so the voter's anonymity may be public.
 * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
 * @param params
 */
export function packageAnonymousEnvelope(params: {
    votes: number[], merkleProof: string, processId: string, privateKey: string,
    processKeys?: IProcessKeys
}): IAnonymousVoteEnvelope {
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

    // TODO: use packageVoteContent()

    throw new Error("TODO: unimplemented")
}

/**
 * Packages the given vote array into a JSON payload that can be sent to Vocdoni Gateways.
 * The voter's signature will be included on the vote, so the voter's anonymity may be public.
 * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
 * @param params
 */
export async function packageSignedEnvelope(params: {
    votes: number[], merkleProof: string, processId: string, walletOrSigner: Wallet | Signer,
    processKeys?: IProcessKeys
}): Promise<ISignedVoteEnvelope> {
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

        const { votePackage, keyIndexes } = packageVoteContent(params.votes, params.processKeys)

        const pkg: ISignedVoteEnvelope = {
            processId: params.processId,
            proof: params.merkleProof,
            nonce,
            votePackage
            // signature:  Must be unset because the body must be singed without the signature field
        }
        if (keyIndexes) pkg.encryptionKeyIndexes = keyIndexes

        pkg.signature = await signJsonBody(pkg, params.walletOrSigner)

        return pkg
    } catch (error) {
        throw new Error("Poll vote Envelope could not be generated")
    }
}

/**
 * Packages the given votes into a base64 string. If encryptionPubKeys is defined, the base64 payload
 * will be encrypted with it.
 * @param votes An array of numbers with the choices
 * @param encryptionPubKeys An ed25519 public key (https://ed25519.cr.yp.to/)
 */
export function packageVoteContent(votes: number[], processKeys?: IProcessKeys): { votePackage: string, keyIndexes?: number[] } {
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

    const payload: IVotePackage = {
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

/** Computes the nullifier of the user's vote within a process where `envelopeType.ANONYMOUS` is disabled.
* Returns a hex string with kecak256(bytes(address) + bytes(processId))
*/
export function getSignedVoteNullifier(address: string, processId: string): string {
    address = address.replace(/^0x/, "")
    processId = processId.replace(/^0x/, "")

    if (address.length != 40) return null
    else if (processId.length != 64) return null

    return utils.keccak256(utils.arrayify("0x" + address + processId))
}


// TYPES

export type IAnonymousVoteEnvelope = {
    processId: string,
    proof: string,  // ZK Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    nullifier: string,   // Hash of the private key
    encryptionKeyIndexes?: number[],   // The index of the keys used to encrypt the votePackage (only for encrypted processes)
    votePackage: string  // base64(jsonString) is encrypted
}

export type ISignedVoteEnvelope = {
    processId: string,
    proof: string,  // Merkle Proof
    nonce: string,  // Unique number per vote attempt, so that replay attacks can't reuse this payload
    encryptionKeyIndexes?: number[],   // The index of the keys used to encrypt the votePackage (only for encrypted processes)
    votePackage: string,  // base64(json(votePackage))
    signature?: string //  Signature including all the rest of the envelope (processId, proof, nonce, votePackage)
}

export type IVotePackage = {
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: number[]  // Directly mapped to the `questions` field of the metadata
}
