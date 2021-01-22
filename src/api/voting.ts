import { Wallet, Signer, utils, ContractTransaction, BigNumber } from "ethers"
import { Gateway, IGateway } from "../net/gateway"
import { FileApi } from "./file"
import { EntityApi } from "./entity"
import { ProcessMetadata, checkValidProcessMetadata, DigestedProcessResults, DigestedProcessResultItem, INewProcessParams } from "../models/process"
import { VOCHAIN_BLOCK_TIME, XDAI_GAS_PRICE, XDAI_CHAIN_ID, SOKOL_CHAIN_ID, SOKOL_GAS_PRICE } from "../constants"
import { JsonSignature, BytesSignature } from "../util/data-signing"
import { Buffer } from "buffer/"  // Previously using "arraybuffer-to-string"
import { Asymmetric } from "../util/encryption"
import { GatewayPool, IGatewayPool } from "../net/gateway-pool"
import { VochainWaiter } from "../util/waiters"
import { Random } from "../util/random"
import { IMethodOverrides, ProcessStatus, ProcessContractParameters, IProcessCreateParams, IProcessStatus, ProcessCensusOrigin } from "../net/contracts"
import {
    VoteEnvelope,
    Proof,
    ProofGraviton,
    // ProofIden3,
    ProofEthereumStorage,
    // ProofEthereumAccount
} from "../../lib/protobuf/build/js/common/vote_pb.js"
import { DVoteGatewayResponseBody } from "net/gateway-dvote"
import { CensusErc20Api } from "./census"

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

export type IProcessKeys = {
    encryptionPubKeys: { idx: number, key: string }[],
    encryptionPrivKeys?: { idx: number, key: string }[],
    commitmentKeys?: { idx: number, key: string }[],
    revealKeys?: { idx: number, key: string }[]
}

const blocksPerM = 60 / VOCHAIN_BLOCK_TIME
const blocksPer10m = 10 * blocksPerM
const blocksPerH = blocksPerM * 60
const blocksPer6h = 6 * blocksPerH
const blocksPerDay = 24 * blocksPerH


export class VotingApi {
    ///////////////////////////////////////////////////////////////////////////////
    // CONTRACT GETTERS
    ///////////////////////////////////////////////////////////////////////////////

    /**
     * Compute the process ID of an Entity at a given index and namespace
     * @param entityAddress
     * @param processCountIndex
     * @param namespace
     */
    static getProcessId(entityAddress: string, processCountIndex: number, namespace: number): string {
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
    static getProcessParameters(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessContractParameters> {
        if (!processId) throw new Error("Invalid processId")
        else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.getProcessesInstance()
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
    static async getProcessMetadata(processId: string, gateway: IGateway | IGatewayPool): Promise<ProcessMetadata> {
        if (!processId) throw new Error("Invalid processId")
        else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

        try {
            const processParams = await VotingApi.getProcessParameters(processId, gateway)
            if (!processParams.metadata) throw new Error("The given voting process has no metadata")

            const jsonData = await FileApi.fetchString(processParams.metadata, gateway)

            return JSON.parse(jsonData)
        } catch (error) {
            const message = (error.message) ? "Could not fetch the process data: " + error.message : "Could not fetch the process data"
            throw new Error(message)
        }
    }

    /**
     * Retrieves the number of blocks on the Vochain
     * @param gateway
     */
    static getBlockHeight(gateway: IGateway | IGatewayPool): Promise<number> {
        return VotingApi.getBlockStatus(gateway)
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
    static getBlockStatus(gateway: IGateway | IGatewayPool): Promise<{ blockNumber: number, blockTimestamp: number, blockTimes: number[] }> {
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
    static estimateBlockAtDateTime(dateTime: Date, gateway: IGateway | IGatewayPool): Promise<number> {
        if (typeof dateTime == "number") dateTime = new Date(dateTime)
        if (!(dateTime instanceof Date)) return null

        return VotingApi.getBlockStatus(gateway).then(status => {
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

    /**
     * Returns the DateTime at which the given block number is expected to be mined
     * @param blockNumber
     * @param gateway
     */
    static estimateDateAtBlock(blockNumber: number, gateway: IGateway | IGatewayPool): Promise<Date> {
        if (!blockNumber) return null

        return VotingApi.getBlockStatus(gateway).then(status => {
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
    static getProcessKeys(processId: string, gateway: IGateway | IGatewayPool): Promise<IProcessKeys> {
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
    static newProcess(processParameters: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata },
        walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
        if (!processParameters) return Promise.reject(new Error("Invalid process metadata"))
        else if (!processParameters.metadata) return Promise.reject(new Error("Invalid process metadata"))
        else if (!walletOrSigner || !walletOrSigner._isSigner)
            return Promise.reject(new Error("Invalid Wallet or Signer"))
        else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool))
            return Promise.reject(new Error("Invalid Gateway object"))

        switch (processParameters.censusOrigin) {
            case ProcessCensusOrigin.OFF_CHAIN_TREE:
            case ProcessCensusOrigin.OFF_CHAIN_TREE_WEIGHTED:
            case ProcessCensusOrigin.OFF_CHAIN_CA:
                return VotingApi.newProcessOffchainCensus(processParameters, walletOrSigner, gateway)
            case ProcessCensusOrigin.ERC20:
            case ProcessCensusOrigin.ERC721:
            case ProcessCensusOrigin.ERC1155:
            case ProcessCensusOrigin.ERC777:
                return VotingApi.newProcessEvmCensus(processParameters, walletOrSigner, gateway)
            default:
                throw new Error("Invalid Census Origin")
        }
    }

    private static async newProcessOffchainCensus(processParameters: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata },
        walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
        try {
            // throw if not valid
            const metadata = checkValidProcessMetadata(processParameters.metadata)

            const address = await walletOrSigner.getAddress()

            // CHECK THAT THE ENTITY EXISTS
            const entityMetadata = await EntityApi.getMetadata(address, gateway)
            if (!entityMetadata) return Promise.reject(new Error("The entity is not yet registered on the blockchain"))

            // UPLOAD THE METADATA
            const strJsonMeta = JSON.stringify(metadata)
            const metadataOrigin = await FileApi.add(strJsonMeta, `process-metadata.json`, walletOrSigner, gateway)
            if (!metadataOrigin) return Promise.reject(new Error("The process metadata could not be uploaded"))

            // Merge parameters and metadata, by now
            const questionCount = processParameters.metadata.questions.length
            const contractParameters = ProcessContractParameters.fromParams({ ...processParameters, questionCount, metadata: metadataOrigin })

            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

            // SET METADATA IN PARAMS
            contractParameters.metadata = metadataOrigin

            // REGISTER THE NEW PROCESS
            const chainId = await gateway.chainId
            let options: IMethodOverrides
            let tx: ContractTransaction
            switch (chainId) {
                case XDAI_CHAIN_ID:
                    options = { gasPrice: XDAI_GAS_PRICE }
                    tx = await processInstance.newProcess(...contractParameters.toContractParams(options))
                    break
                case SOKOL_CHAIN_ID:
                    const addr = await walletOrSigner.getAddress()
                    const nonce = await walletOrSigner.connect(gateway.provider).provider.getTransactionCount(addr)
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

            // TODO: This might be simplified in the future (skip the process list updates here)

            // UPDATE THE ENTITY
            if (!entityMetadata.votingProcesses) entityMetadata.votingProcesses = { active: [], ended: [] }
            entityMetadata.votingProcesses.active = [processId].concat(entityMetadata.votingProcesses.active || [])

            await EntityApi.setMetadata(address, entityMetadata, walletOrSigner, gateway)

            return processId
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    private static async newProcessEvmCensus(processParameters: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata },
        walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
        try {
            // throw if not valid
            const metadata = checkValidProcessMetadata(processParameters.metadata)
            // const holderAddress = await walletOrSigner.getAddress()

            // CHECK THAT THE TOKEN EXISTS
            if (!await CensusErc20Api.isRegistered(processParameters.tokenAddress, gateway)) {
                return Promise.reject(new Error("The token is not yet registered"))
            }

            // UPLOAD THE METADATA
            const strJsonMeta = JSON.stringify(metadata)
            const metadataOrigin = await FileApi.add(strJsonMeta, "process-metadata.json", walletOrSigner, gateway)
            if (!metadataOrigin) return Promise.reject(new Error("The process metadata could not be uploaded"))

            // Merge parameters and metadata, by now
            const questionCount = processParameters.metadata.questions.length
            const contractParameters = ProcessContractParameters.fromParams({ ...processParameters, questionCount, metadata: metadataOrigin })

            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

            // SET METADATA IN PARAMS
            contractParameters.metadata = metadataOrigin

            // REGISTER THE NEW PROCESS
            const chainId = await gateway.chainId
            let options: IMethodOverrides
            let tx: ContractTransaction
            switch (chainId) {
                case XDAI_CHAIN_ID:
                    options = { gasPrice: XDAI_GAS_PRICE }
                    tx = await processInstance.newProcess(...contractParameters.toContractParams(options))
                    break
                case SOKOL_CHAIN_ID:
                    const addr = await walletOrSigner.getAddress()
                    const nonce = await walletOrSigner.connect(gateway.provider).provider.getTransactionCount(addr)
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

            const count = await processInstance.getEntityProcessCount(processParameters.tokenAddress)
            if (!count || count.isZero()) return Promise.reject(new Error("The process could not be created"))
            const processId = await processInstance.getProcessId(processParameters.tokenAddress, count.toNumber() - 1, contractParameters.namespace)

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
    static async setStatus(processId: string, newStatus: IProcessStatus, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

        try {
            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

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
    static async incrementQuestionIndex(processId: string, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

        try {
            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

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
    static async setCensus(processId: string, censusRoot: string, censusUri: string, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

        try {
            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

            const tx = await processInstance.setCensus(processId, censusRoot, censusUri)
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
    static async setResults(processId: string, results: number[][], envelopeCount: number, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

        try {
            const processInstance = await gateway.getProcessesInstance(walletOrSigner)

            const tx = await processInstance.setResults(processId, results, envelopeCount)
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
    static async getEnvelope(processId: string, gateway: IGateway | IGatewayPool, nullifier: string): Promise<string> {
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
    static getEnvelopeHeight(processId: string, gateway: IGateway | IGatewayPool): Promise<number> {
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
    static async getProcessList(entityId: string, gateway: IGateway | IGatewayPool, afterId?: string): Promise<string[]> {
        if (!entityId) throw new Error("Invalid Entity Id")
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) throw new Error("Invalid Gateway object")

        try {
            const req: any = {
                method: "getProcessList",
                entityId
            }
            if (afterId) req.fromId = afterId

            const response = await gateway.sendRequest(req)
            if (!response || !Array.isArray(response.processList || [])) throw new Error("Invalid response")
            return response.processList || []
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
    static getEnvelopeList(processId: string,
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
    static getRawResults(processId: string, gateway: IGateway | IGatewayPool): Promise<{ results: string[][], status: ProcessStatus }> {
        if (!gateway || !processId)
            return Promise.reject(new Error("No process ID provided"))
        else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
            return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({ method: "getResults", processId })
            .then((response) => {
                if (response.results && !Array.isArray(response.results)) throw new Error("The gateway response is not valid")
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
    static async getResultsDigest(processId: string, gateway: IGateway | IGatewayPool): Promise<DigestedProcessResults> {
        if (!processId)
            throw new Error("No process ID provided")
        else if (!((gateway instanceof Gateway || gateway instanceof GatewayPool)))
            throw new Error("Invalid Gateway object")

        processId = processId.startsWith("0x") ? processId : "0x" + processId
        try {
            const processState = await VotingApi.getProcessParameters(processId, gateway)
            if (processState.status.isCanceled) return { questions: [] }

            // Encrypted?
            let procKeys: IProcessKeys, retries: number
            const currentBlock = await VotingApi.getBlockHeight(gateway)
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
                    procKeys = await VotingApi.getProcessKeys(processId, gateway)
                    if (procKeys && procKeys.encryptionPrivKeys && procKeys.encryptionPrivKeys.length) break

                    await VochainWaiter.wait(2, gateway)
                    retries--
                } while (retries >= 0)
                if (!procKeys || !procKeys.encryptionPrivKeys || !procKeys.encryptionPrivKeys.length) return { questions: [] }
            }

            const { results, status } = await VotingApi.getRawResults(processId, gateway)
            const metadata = await VotingApi.getProcessMetadata(processId, gateway)

            const resultsDigest: DigestedProcessResults = { questions: [] }
            const zippedQuestions = metadata.questions.map((e, i) => ({ meta: e, result: results[i] }))
            resultsDigest.questions = zippedQuestions.map((zippedEntry, idx): DigestedProcessResultItem => {
                const zippedOptions = zippedEntry.meta.choices.map((e, i) => ({ title: e.title, value: zippedEntry.result[i] }))
                return {
                    title: zippedEntry.meta.title,
                    voteResults: zippedOptions.map((option) => ({
                        title: option.title,
                        votes: BigNumber.from(option.value || 0),
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
    // VOCHAIN SETTERS
    ///////////////////////////////////////////////////////////////////////////////

    /**
     * Submit the vote envelope to a Gateway
     * @param {Uint8Array} voteEnvelope Binary contents of the (protobuf) Vote Envelope
     * @param {String} signature Hex encoded signature of the voteEnvelope
     * @param {Gateway|GatewayPool} gateway
     */
    static async submitEnvelope(bytesVoteEnvelope: Uint8Array, hexSignature: string = "", gateway: IGateway | GatewayPool): Promise<DVoteGatewayResponseBody> {
        if (!bytesVoteEnvelope) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway || !(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

        const base64VoteEnvelope = Buffer.from(bytesVoteEnvelope).toString("base64")
        return gateway.sendRequest({ method: "submitEnvelope", payload: base64VoteEnvelope, signature: hexSignature || "" })
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
    static getEnvelopeStatus(processId: string, nullifier: string, gateway: IGateway | IGatewayPool): Promise<{ registered: boolean, date?: Date, block?: number }> {
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
    static packageAnonymousEnvelope(params: {
        votes: number[], censusProof: string, processId: string, privateKey: string,
        processKeys?: IProcessKeys
    }): Uint8Array {
        if (!params) throw new Error("Invalid parameters");
        if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
        else if (typeof params.censusProof != "string" || !params.censusProof.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid Merkle Proof")
        else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
        else if (!params.privateKey || !params.privateKey.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid private key")
        else if (params.processKeys) {
            if (!Array.isArray(params.processKeys.encryptionPubKeys) || !params.processKeys.encryptionPubKeys.every(
                item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
                throw new Error("Some encryption public keys are not valid")
            }
        }

        // TODO: Use Graviton Proof

        // TODO: use packageVoteContent()

        throw new Error("TODO: unimplemented")
    }

    /**
     * Packages the given vote array into a protobuf message that can be sent to Vocdoni Gateways.
     * The voter's signature will be included on the vote, so the voter's anonymity may be public.
     * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
     * @param params
     */
    static async packageSignedEnvelope(params: {
        censusOrigin: ProcessCensusOrigin,
        votes: number[], processId: string, walletOrSigner: Wallet | Signer,
        censusProof: string | { key: string, proof: string[], value: string },
        processKeys?: IProcessKeys
    }): Promise<{ envelope: Uint8Array, signature: string }> {
        if (!params) throw new Error("Invalid parameters")
        else if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
        else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
        else if (!params.walletOrSigner || !params.walletOrSigner.signMessage) throw new Error("Invalid wallet or signer")
        else if (params.processKeys) {
            if (!Array.isArray(params.processKeys.encryptionPubKeys) || !params.processKeys.encryptionPubKeys.every(
                item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
                throw new Error("Some encryption public keys are not valid")
            }
        }

        try {
            const proof = new Proof()

            if (params.censusOrigin.isOffChain || params.censusOrigin.isOffChainWeighted) {
                // Check census proof
                if (typeof params.censusProof != "string" || !params.censusProof.match(/^(0x)?[0-9a-zA-Z]+$/))
                    throw new Error("Invalid census proof (must be a hex string)")

                const gProof = new ProofGraviton()
                gProof.setSiblings(new Uint8Array(Buffer.from((params.censusProof as string).replace("0x", ""), "hex")))
                proof.setGraviton(gProof)
            } else if (params.censusOrigin.isErc20 || params.censusOrigin.isErc721 || params.censusOrigin.isErc1155 || params.censusOrigin.isErc777) {
                // Check census proof
                if (typeof params.censusProof == "string") throw new Error("Invalid census proof for an EVM process")
                else if (typeof params.censusProof.key != "string" ||
                    !Array.isArray(params.censusProof.proof) || typeof params.censusProof.value != "string")
                    throw new Error("Invalid census proof (must be an object)")

                const esProof = new ProofEthereumStorage()
                esProof.setKey(new Uint8Array(Buffer.from(params.censusProof.key.replace("0x", ""), "hex")))
                const siblings = params.censusProof.proof.map(sibling => new Uint8Array(Buffer.from(sibling.replace("0x", ""), "hex")))

                let hexValue = params.censusProof.value
                if (params.censusProof.value.length % 2 !== 0) {
                    hexValue = params.censusProof.value.replace("0x", "0x0")
                }
                esProof.setValue(utils.zeroPad(hexValue, 32))

                esProof.setSiblingsList(siblings)
                proof.setEthereumstorage(esProof)
            }
            else { // if (params.censusOrigin.isOffChainCA) {
                // TODO: Implement
                throw new Error("This process type is not supported yet")
            }

            const nonce = Random.getHex().substr(2)
            const envelope = new VoteEnvelope()
            envelope.setProof(proof)
            envelope.setProcessid(new Uint8Array(Buffer.from(params.processId.replace("0x", ""), "hex")))
            envelope.setNonce(new Uint8Array(Buffer.from(nonce, "hex")))

            const { votePackage, keyIndexes } = VotingApi.packageVoteContent(params.votes, params.processKeys)
            envelope.setVotepackage(new Uint8Array(votePackage))
            if (keyIndexes) envelope.setEncryptionkeyindexesList(keyIndexes)

            const bytes = new Uint8Array(envelope.serializeBinary())
            const signature = await BytesSignature.sign(bytes, params.walletOrSigner)

            return { envelope: bytes, signature }
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
    static packageVoteContent(votes: number[], processKeys?: IProcessKeys): { votePackage: Buffer, keyIndexes?: number[] } {
        if (!Array.isArray(votes)) throw new Error("Invalid votes")
        else if (votes.some(vote => typeof vote != "number")) throw new Error("Votes needs to be an array of numbers")
        else if (processKeys) {
            if (!Array.isArray(processKeys.encryptionPubKeys) || !processKeys.encryptionPubKeys.every(
                item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
                throw new Error("Some encryption public keys are not valid")
            }
        }

        // produce a 8 byte nonce
        const nonce = Random.getHex().substr(2, 16)

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

            let votePackage: Buffer
            for (let i = 0; i < publicKeys.length; i++) {
                if (i > 0) votePackage = Asymmetric.encryptRaw(votePackage, publicKeys[i]) // reencrypt votePackage
                else votePackage = Asymmetric.encryptRaw(Buffer.from(strPayload), publicKeys[i]) // encrypt the first
            }
            return { votePackage, keyIndexes: publicKeysIdx }
        }
        else {
            return { votePackage: Buffer.from(strPayload) }
        }
    }

    /**
     * Computes the nullifier of the user's vote within a process where `envelopeType.ANONYMOUS` is disabled.
     * Returns a hex string with kecak256(bytes(address) + bytes(processId))
     */
    static getSignedVoteNullifier(address: string, processId: string): string {
        address = address.replace(/^0x/, "")
        processId = processId.replace(/^0x/, "")

        if (address.length != 40) return null
        else if (processId.length != 64) return null

        return utils.keccak256(utils.arrayify("0x" + address + processId))
    }
}
