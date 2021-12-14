import { ContractTransaction } from "@ethersproject/contracts"
import { BigNumber } from "@ethersproject/bignumber"
import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"

import { GatewayArchive, GatewayArchiveApi, FileApi } from "@vocdoni/client"
import { EntityApi } from "./entity-calls"
import { ProcessMetadata, checkValidProcessMetadata, INewProcessParams } from "@vocdoni/data-models"
import { VOCHAIN_BLOCK_TIME, XDAI_GAS_PRICE, XDAI_CHAIN_ID, SOKOL_CHAIN_ID, SOKOL_GAS_PRICE, ZK_VOTING_CIRCUIT_WASM_FILE_NAME, ZK_VOTING_ZKEY_FILE_NAME, ZK_VOTING_VERIFICATION_KEY_FILE_NAME, Random } from "@vocdoni/common"
import { BytesSignature } from "@vocdoni/signing"
import { Buffer } from "buffer/"
import { VochainWaiter } from "./util/waiters"
import { IMethodOverrides, ProcessContractParameters, IProcessStatus, ProcessCensusOrigin } from "@vocdoni/contract-wrappers"
import {
    Tx, SignedTx,
    VoteEnvelope,
    VochainProcessStatus
} from "@vocdoni/data-models"
import { IGatewayClient, IGatewayDVoteClient, IGatewayWeb3Client, DVoteGatewayResponseBody, IRequestParameters, ResultsNotAvailableError } from "@vocdoni/client"
import { Erc20TokensApi } from "@vocdoni/client"
import { ensure0x, strip0x, bigIntToLeBuffer } from "@vocdoni/common"
import { ContentHashedUri } from "@vocdoni/client"
import { BlockStatus, ProcessDetails, ProcessKeys, ProcessState, ProcessSummary, EnvelopeMeta, EnvelopeFull, ProcessCircuitInfo, AnonymousEnvelopeParams, VoteValues, RawResults } from "./types"

export { VochainWaiter, EthWaiter } from "./util/waiters"

const blocksPerM = 60 / VOCHAIN_BLOCK_TIME
const blocksPer10m = 10 * blocksPerM
const blocksPerH = blocksPerM * 60
const blocksPer6h = 6 * blocksPerH
const blocksPerDay = 24 * blocksPerH

export namespace VotingApi {
    ///////////////////////////////////////////////////////////////////////////////
    // CONTRACT GETTERS
    ///////////////////////////////////////////////////////////////////////////////

    /**
     * Fetch the Ethereum parameters and metadata for the given processId using the given gateway
     * @param processId
     * @param gateway
     * @param params
     */
    export function getProcess(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<ProcessDetails> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        let state: ProcessState
        return getProcessState(processId, gateway, params)
            .then(result => {
                state = result

                if (!result.metadata) {
                    // Fallback => try on Ethereum
                    return getProcessContractParameters(processId, gateway)
                        .then(params => FileApi.fetchString(params.metadata, gateway))
                        .catch(() => {
                            throw new Error("The given voting process has no metadata")
                        })
                }

                return FileApi.fetchString(result.metadata, gateway)
            })
            .then(strMetadata => {
                return {
                    id: processId,
                    metadata: JSON.parse(strMetadata),
                    state
                }
            })
            .catch(error => {
                const message = (error.message) ? "Could not fetch the process details: " + error.message : "Could not fetch the process details"
                throw new Error(message)
            })
    }

    /**
     * Fetch the full state of the given processId on the Vochain
     * @param processId
     * @param gateway
     * @param params
     */
    export function getProcessState(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<ProcessState> {
        if (!processId) return Promise.reject(new Error("Empty process ID"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getProcessInfo", processId })
            .catch((error) => {
                // TODO Refactor errors
                if (params.skipArchive || !error.message.includes("No data found for this key")) {
                    throw error
                }
                return GatewayArchiveApi.getProcess(processId, gateway, error.message)
            })
            .then((response) => {
                if (typeof response.process !== 'object') throw new Error()

                const result = response.process
                result.censusRoot = ensure0x(result.censusRoot)
                result.entityId = ensure0x(result.entityId)
                result.processId = ensure0x(result.processId)
                return result
            })
    }

    /**
     * Fetch the Vochain headers of the given processId on the Vochain. This operation is more lightweight than getProcessInfo
     * @param processId
     * @param gateway
     * @param params
     */
    export function getProcessSummary(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<ProcessSummary> {
        if (!processId) return Promise.reject(new Error("Empty process ID"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getProcessSummary", processId })
            .catch((error) => {
                // TODO Refactor errors
                if (params.skipArchive || !error.message.includes("No data found for this key")) {
                    throw error
                }
                return GatewayArchiveApi.getProcess(processId, gateway, error.message)
                    .then(processArchiveData => GatewayArchive.mapToGetProcessSummary(processArchiveData))
            })
            .then((response) => {
                const { processSummary } = response

                return {
                    entityId: ensure0x(processSummary.entityId),
                    envelopeHeight: processSummary.envelopeHeight,
                    status: typeof processSummary.status === "number" ? processSummary.status : VochainProcessStatus[processSummary.state as string],
                    envelopeType: processSummary.envelopeType || {},
                    startBlock: processSummary.startBlock,
                    endBlock: processSummary.endBlock ? processSummary.endBlock : processSummary.startBlock + processSummary.blockCount,
                    entityIndex: processSummary.entityIndex,
                    metadata: processSummary.metadata,
                    sourceNetworkId: processSummary.sourceNetworkID || processSummary.sourceNetworkId,
                } as ProcessSummary
            })
    }

    /**
     * Fetch the JSON metadata for the given processId using the given gateway
     * @param processId
     * @param gateway
     */
    export function getProcessMetadata(processId: string, gateway: IGatewayClient): Promise<ProcessMetadata> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return getProcessSummary(processId, gateway)
            .then(processInfo => {

                if (!processInfo.metadata) {
                    // Fallback => try on Ethereum
                    return getProcessContractParameters(processId, gateway)
                        .then(params => FileApi.fetchString(params.metadata, gateway))
                        .catch(() => {
                            throw new Error("The given voting process has no metadata")
                        })
                }

                return FileApi.fetchString(processInfo.metadata, gateway)
            })
            .then(str => JSON.parse(str))
    }

    /**
     * Fetch the raw parameters on Ethereum for the given processId using the given gateway
     * @param processId
     * @param gateway
     */
    export function getProcessContractParameters(processId: string, gateway: IGatewayWeb3Client): Promise<ProcessContractParameters> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.getProcessesInstance()
            .then(processInstance => processInstance.get(processId))
            .then(params => ProcessContractParameters.fromContract(params))
            .catch(error => {
                const message = (error.message) ? "Could not fetch the process data: " + error.message : "Could not fetch the process data"
                throw new Error(message)
            })
    }

    /**
     * Fetch the details of the ZK circuit used for the given process ID
     * @param processId
     * @param gateway
     * @returns The relevant parameters and the SHA256 digests of the witness, the zKey and the verification key
     */
    export function getProcessCircuitInfo(processId: string, gateway: IGatewayClient): Promise<ProcessCircuitInfo> {
        if (!processId) return Promise.reject(new Error("Empty process ID"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getProcessCircuitConfig", processId })
            .then(response => {
                if (!response?.circuitConfig) throw new Error("Invalid response")

                return {
                    index: response.circuitIndex || 0,
                    uri: response.circuitConfig.url,
                    circuitPath: response.circuitConfig.circuitPath,
                    maxSize: response.circuitConfig.parameters[0],
                    witnessHash: "0x" + Buffer.from(response.circuitConfig.witnessHash, "base64").toString("hex"),
                    zKeyHash: "0x" + Buffer.from(response.circuitConfig.zKeyHash, "base64").toString("hex"),
                    vKHash: "0x" + Buffer.from(response.circuitConfig.vKHash, "base64").toString("hex")
                }
            })
    }
    /**
     * Retrieves the number of blocks on the Vochain
     * @param gateway
     */
    export function getBlockHeight(gateway: IGatewayDVoteClient): Promise<number> {
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
    export function getBlockStatus(gateway: IGatewayDVoteClient): Promise<BlockStatus> {
        if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

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
    export function estimateBlockAtDateTime(dateTime: Date, gateway: IGatewayDVoteClient): Promise<number> {
        if (typeof dateTime == "number") dateTime = new Date(dateTime)
        else if (!(dateTime instanceof Date)) return null

        return getBlockStatus(gateway)
            .then(status => estimateBlockAtDateTimeSync(dateTime, status))
    }

    /**
     * Returns the block number that is expected to be current at the given date and time
     * @param dateTime
     * @param blockStatus The block status to use for the estimation (reported by gateways)
     */
    export function estimateBlockAtDateTimeSync(dateTime: Date, blockStatus: BlockStatus): number {
        if (typeof dateTime == "number") dateTime = new Date(dateTime)
        else if (!(dateTime instanceof Date)) return null

        let averageBlockTime = VOCHAIN_BLOCK_TIME * 1000
        let weightA: number, weightB: number

        // Diff between the last mined block and the given date
        const dateDiff = Math.abs(dateTime.getTime() - blockStatus.blockTimestamp)

        // blockStatus.blockTime => [1m, 10m, 1h, 6h, 24h]

        if (dateDiff >= 1000 * 60 * 60 * 24) {
            if (blockStatus.blockTimes[4] > 0) averageBlockTime = blockStatus.blockTimes[4]
            else if (blockStatus.blockTimes[3] > 0) averageBlockTime = blockStatus.blockTimes[3]
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 60 * 6) {
            // 1000 * 60 * 60 * 6 <= dateDiff < 1000 * 60 * 60 * 24
            if (blockStatus.blockTimes[4] > 0 && blockStatus.blockTimes[3] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 60 * 6) / (1000 * 60 * 60)
                weightB = pivot / (24 - 6) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * blockStatus.blockTimes[3] + weightB * blockStatus.blockTimes[4]
            }
            else if (blockStatus.blockTimes[3] > 0) averageBlockTime = blockStatus.blockTimes[3]
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 60) {
            // 1000 * 60 * 60 <= dateDiff < 1000 * 60 * 60 * 6
            if (blockStatus.blockTimes[3] > 0 && blockStatus.blockTimes[2] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 60) / (1000 * 60 * 60)
                weightB = pivot / (6 - 1) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * blockStatus.blockTimes[2] + weightB * blockStatus.blockTimes[3]
            }
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60 * 10) {
            // 1000 * 60 * 10 <= dateDiff < 1000 * 60 * 60
            if (blockStatus.blockTimes[2] > 0 && blockStatus.blockTimes[1] > 0) {
                const pivot = (dateDiff - 1000 * 60 * 10) / (1000 * 60)
                weightB = pivot / (60 - 10) // 0..1
                weightA = 1 - weightB

                averageBlockTime = weightA * blockStatus.blockTimes[1] + weightB * blockStatus.blockTimes[2]
            }
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (dateDiff >= 1000 * 60) {
            // 1000 * 60 <= dateDiff < 1000 * 60 * 6
            const pivot = (dateDiff - 1000 * 60) / (1000 * 60)
            weightB = pivot / (10 - 1) // 0..1
            weightA = 1 - weightB

            if (blockStatus.blockTimes[1] > 0 && blockStatus.blockTimes[0] > 0) {
                averageBlockTime = weightA * blockStatus.blockTimes[0] + weightB * blockStatus.blockTimes[1]
            }
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else {
            if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }

        const estimatedBlockDiff = dateDiff / averageBlockTime
        const estimatedBlock = dateTime.getTime() < blockStatus.blockTimestamp ?
            blockStatus.blockNumber - Math.ceil(estimatedBlockDiff) :
            blockStatus.blockNumber + Math.floor(estimatedBlockDiff)

        if (estimatedBlock < 0) return 0
        return estimatedBlock
    }

    /**
     * Returns the DateTime at which the given block number is expected to be mined
     * @param blockNumber
     * @param gateway
     */
    export function estimateDateAtBlock(blockNumber: number, gateway: IGatewayDVoteClient): Promise<Date> {
        if (!blockNumber || blockNumber < 0) return null

        return getBlockStatus(gateway)
            .then(status => estimateDateAtBlockSync(blockNumber, status))
    }

    /**
     * Returns the DateTime at which the given block number is expected to be mined
     * @param blockNumber
     * @param blockStatus The block status to use for the estimation (reported by gateways)
     */
    export function estimateDateAtBlockSync(blockNumber: number, blockStatus: BlockStatus): Date {
        if (!blockNumber) return null

        // Diff between the last mined block and the given one
        const blockDiff = Math.abs(blockNumber - blockStatus.blockNumber)
        let averageBlockTime = VOCHAIN_BLOCK_TIME * 1000
        let weightA: number, weightB: number

        // blockStatus.blockTime => [1m, 10m, 1h, 6h, 24h]
        if (blockDiff > blocksPerDay) {
            if (blockStatus.blockTimes[4] > 0) averageBlockTime = blockStatus.blockTimes[4]
            else if (blockStatus.blockTimes[3] > 0) averageBlockTime = blockStatus.blockTimes[3]
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (blockDiff > blocksPer6h) {
            // blocksPer6h <= blockDiff < blocksPerDay
            const pivot = (blockDiff - blocksPer6h) / (blocksPerH)
            weightB = pivot / (24 - 6) // 0..1
            weightA = 1 - weightB

            if (blockStatus.blockTimes[4] > 0 && blockStatus.blockTimes[3] > 0) {
                averageBlockTime = weightA * blockStatus.blockTimes[3] + weightB * blockStatus.blockTimes[4]
            }
            else if (blockStatus.blockTimes[3] > 0) averageBlockTime = blockStatus.blockTimes[3]
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (blockDiff > blocksPerH) {
            // blocksPerH <= blockDiff < blocksPer6h
            const pivot = (blockDiff - blocksPerH) / (blocksPerH)
            weightB = pivot / (6 - 1) // 0..1
            weightA = 1 - weightB

            if (blockStatus.blockTimes[3] > 0 && blockStatus.blockTimes[2] > 0) {
                averageBlockTime = weightA * blockStatus.blockTimes[2] + weightB * blockStatus.blockTimes[3]
            }
            else if (blockStatus.blockTimes[2] > 0) averageBlockTime = blockStatus.blockTimes[2]
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (blockDiff > blocksPer10m) {
            // blocksPer10m <= blockDiff < blocksPerH
            const pivot = (blockDiff - blocksPer10m) / (blocksPerM)
            weightB = pivot / (60 - 10) // 0..1
            weightA = 1 - weightB

            if (blockStatus.blockTimes[2] > 0 && blockStatus.blockTimes[1] > 0) {
                averageBlockTime = weightA * blockStatus.blockTimes[1] + weightB * blockStatus.blockTimes[2]
            }
            else if (blockStatus.blockTimes[1] > 0) averageBlockTime = blockStatus.blockTimes[1]
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else if (blockDiff > blocksPerM) {
            // blocksPerM <= blockDiff < blocksPer10m
            const pivot = (blockDiff - blocksPerM) / (blocksPerM)
            weightB = pivot / (10 - 1) // 0..1
            weightA = 1 - weightB

            if (blockStatus.blockTimes[1] > 0 && blockStatus.blockTimes[0] > 0) {
                averageBlockTime = weightA * blockStatus.blockTimes[0] + weightB * blockStatus.blockTimes[1]
            }
            else if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }
        else {
            if (blockStatus.blockTimes[0] > 0) averageBlockTime = blockStatus.blockTimes[0]
        }

        const targetTimestamp = blockStatus.blockTimestamp + (blockNumber - blockStatus.blockNumber) * averageBlockTime
        return new Date(targetTimestamp)
    }

    /**
     * Retrieves the current price of process creation
     * @param gateway
     */
    export function getProcessPrice(gateway: IGatewayWeb3Client): Promise<BigNumber> {
        if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.getProcessesInstance()
            .then(procInstance => procInstance.processPrice())
    }

    /**
     * Retrieves the encryption public keys of the given process
     * @param processId
     * @param gateway
     */
    export function getProcessKeys(processId: string, gateway: IGatewayDVoteClient): Promise<ProcessKeys> {
        if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getProcessKeys", processId })
            .then((response) => {
                if (!response) throw new Error("The gateway response is not correct")
                const result: ProcessKeys = { encryptionPubKeys: [], encryptionPrivKeys: [], commitmentKeys: [], revealKeys: [] }
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
     * Retrieves the cumulative weight that has been casted in votes for the given process ID.
     * @param processId
     * @param gateway
     * @param params
     */
    export function getResultsWeight(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<BigNumber> {
        if (!processId) return Promise.reject(new Error("Empty process ID"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getResultsWeight", processId })
            .catch((error) => {
                // TODO Refactor errors
                if (params.skipArchive || !error.message.includes("No data found for this key")) {
                    throw error
                }
                return GatewayArchiveApi.getProcess(processId, gateway, error.message)
                    .then(processArchiveData => GatewayArchive.mapToGetResultsWeight(processArchiveData))
            })
            .then((response) => {
                if (typeof response.weight !== 'string' || !BigNumber.isBigNumber(response.weight)) {
                    throw new Error("The weight value is not valid")
                }

                return BigNumber.from(response.weight)
            })
    }

    ///////////////////////////////////////////////////////////////////////////////
    // CONTRACT SETTERS
    ///////////////////////////////////////////////////////////////////////////////

    /**
     * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
     * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
     * @param parameters The details sent to the smart contract, along with the human readable metadata. See https://vocdoni.io/docs/#/architecture/components/process?id=internal-structs
     * @param walletOrSigner
     * @param gateway
     * @returns The process ID
     */
    export function newProcess(processParameters: INewProcessParams, walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<string> {
        if (!processParameters) return Promise.reject(new Error("Invalid process metadata"))
        else if (!processParameters.metadata) return Promise.reject(new Error("Invalid process metadata"))
        else if (!walletOrSigner || !walletOrSigner._isSigner)
            return Promise.reject(new Error("Invalid Wallet or Signer"))
        else if (!gateway)
            return Promise.reject(new Error("Invalid gateway client"))
        const censusOrigin = ((typeof processParameters.censusOrigin) === "number") ? processParameters.censusOrigin : (processParameters.censusOrigin as ProcessCensusOrigin).value
        switch (censusOrigin) {
            case ProcessCensusOrigin.OFF_CHAIN_TREE:
            case ProcessCensusOrigin.OFF_CHAIN_TREE_WEIGHTED:
            case ProcessCensusOrigin.OFF_CHAIN_CA:
                return newProcessOffchainCensus(processParameters, walletOrSigner, gateway)
            case ProcessCensusOrigin.ERC20:
            case ProcessCensusOrigin.ERC721:
            case ProcessCensusOrigin.ERC1155:
            case ProcessCensusOrigin.ERC777:
                return newProcessEvmCensus(processParameters, walletOrSigner, gateway)
            default:
                throw new Error("Invalid Census Origin")
        }
    }

    /**
     * Use the given JSON metadata to create a new voting process from the Entity ID associated to the given wallet account.
     * The Census Merkle Root and Merkle Tree will be published to the blockchain, and the Metadata will be stored on IPFS
     * @param processParameters The details sent to the smart contract, along with the human readable metadata. See https://vocdoni.io/docs/#/architecture/components/process?id=internal-structs
     * @param walletOrSigner
     * @param gateway
     * @returns The process ID
     */
    async function newProcessOffchainCensus(processParameters: INewProcessParams,
        walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<string> {
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
            const ethChainId = await gateway.chainId
            const options: IMethodOverrides = {
                value: await getProcessPrice(gateway)
            }
            let tx: ContractTransaction
            switch (ethChainId) {
                case XDAI_CHAIN_ID:
                    let gasPrice = XDAI_GAS_PRICE
                    try {
                        gasPrice = await walletOrSigner.provider.getGasPrice()
                    } catch (error) {
                        console.log("Could not estimate gas price with 'getGasPrice, using default value: '", gasPrice.toString())
                    }
                    options.gasPrice = gasPrice
                    tx = await processInstance.newProcessStd(...contractParameters.toContractParamsStd(options))
                    break
                case SOKOL_CHAIN_ID:
                    const addr = await walletOrSigner.getAddress()
                    options.nonce = await walletOrSigner.connect(gateway.provider).provider.getTransactionCount(addr)
                    options.gasPrice = SOKOL_GAS_PRICE
                    tx = await processInstance.newProcessStd(...contractParameters.toContractParamsStd(options))
                    break
                default:
                    tx = await processInstance.newProcessStd(...contractParameters.toContractParamsStd(options))
            }

            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()

            const count = await processInstance.getEntityProcessCount(address)
            if (!count || count.isZero()) return Promise.reject(new Error("The process could not be created"))

            const namespaceId = await processInstance.namespaceId()
            const processId = await processInstance.getProcessId(address, count.toNumber() - 1, namespaceId, ethChainId)

            return processId
        }
        catch (err) {
            console.error(err)
            throw err
        }
    }

    /**
    * Use the given JSON metadata to create a new voting process using an EVM-based census from the given token address.
    * The given Metadata will be stored on IPFS
    * @param processParameters The details sent to the smart contract, along with the human readable metadata. See https://vocdoni.io/docs/#/architecture/components/process?id=internal-structs
    * @param walletOrSigner
    * @param gateway
    * @returns The process ID
    */
    async function newProcessEvmCensus(processParameters: INewProcessParams,
        walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<string> {
        try {
            // throw if not valid
            const metadata = checkValidProcessMetadata(processParameters.metadata)

            // CHECK THAT THE TOKEN EXISTS
            if (!await Erc20TokensApi.isRegistered(processParameters.tokenAddress, gateway)) {
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
            const ethChainId = await gateway.chainId
            const options: IMethodOverrides = {
                value: await getProcessPrice(gateway)
            }
            let tx: ContractTransaction
            switch (ethChainId) {
                case XDAI_CHAIN_ID:
                    let gasPrice = XDAI_GAS_PRICE
                    try {
                        gasPrice = await walletOrSigner.connect(gateway.provider).provider.getGasPrice()
                    } catch (error) {
                        console.log("Could not estimate gas price with 'getGasPrice, using default value: '", gasPrice.toString())
                    }
                    options.gasPrice = gasPrice
                    tx = await processInstance.newProcessEvm(...contractParameters.toContractParamsEvm(options))
                    break
                case SOKOL_CHAIN_ID:
                    const addr = await walletOrSigner.getAddress()
                    options.nonce = await walletOrSigner.connect(gateway.provider).provider.getTransactionCount(addr)
                    options.gasPrice = SOKOL_GAS_PRICE
                    tx = await processInstance.newProcessEvm(...contractParameters.toContractParamsEvm(options))
                    break
                default:
                    tx = await processInstance.newProcessEvm(...contractParameters.toContractParamsEvm(options))
            }

            if (!tx) throw new Error("Could not start the blockchain transaction")
            await tx.wait()

            const count = await processInstance.getEntityProcessCount(processParameters.tokenAddress)
            if (!count || count.isZero()) return Promise.reject(new Error("The process could not be created"))

            const namespaceId = await processInstance.namespaceId()
            const processId = await processInstance.getProcessId(processParameters.tokenAddress, count.toNumber() - 1, namespaceId, ethChainId)

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
    export async function setStatus(processId: string, newStatus: IProcessStatus, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway) throw new Error("Invalid gateway client")

        try {
            let processInstance = await gateway.getProcessesInstance(walletOrSigner)
            const creationInstanceAddr = await processInstance.getCreationInstance(processId)

            if (creationInstanceAddr != processInstance.address) {
                processInstance = await gateway.getProcessesInstance(walletOrSigner, creationInstanceAddr)
            }

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
    export async function incrementQuestionIndex(processId: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway) throw new Error("Invalid gateway client")

        try {
            let processInstance = await gateway.getProcessesInstance(walletOrSigner)
            const creationInstanceAddr = await processInstance.getCreationInstance(processId)

            if (creationInstanceAddr != processInstance.address) {
                processInstance = await gateway.getProcessesInstance(walletOrSigner, creationInstanceAddr)
            }

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
    export async function setCensus(processId: string, censusRoot: string, censusUri: string, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway) throw new Error("Invalid gateway client")

        try {
            let processInstance = await gateway.getProcessesInstance(walletOrSigner)
            const creationInstanceAddr = await processInstance.getCreationInstance(processId)

            if (creationInstanceAddr != processInstance.address) {
                processInstance = await gateway.getProcessesInstance(walletOrSigner, creationInstanceAddr)
            }

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
    export async function setResults(processId: string, results: number[][], envelopeCount: number, vochainId: number, walletOrSigner: Wallet | Signer, gateway: IGatewayWeb3Client): Promise<void> {
        if (!processId) throw new Error("Invalid process ID")
        else if (!walletOrSigner) throw new Error("Invalid Wallet or Signer")
        else if (!gateway) throw new Error("Invalid gateway client")

        try {
            const resultsInstance = await gateway.getResultsInstance(walletOrSigner)

            const tx = await resultsInstance.setResults(processId, results, envelopeCount, vochainId)
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
     * Fetches the vote envelope for a given nullifier
     * @param nullifier
     * @param gateway
     */
    export async function getEnvelope(nullifier: string, gateway: IGatewayDVoteClient): Promise<EnvelopeFull> {
        if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getEnvelope", nullifier })
            .then((response) => {
                if (!response.envelope) throw new Error("The envelope could not be retrieved")
                return response.envelope
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
     * @param params
     */
    export function getEnvelopeHeight(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<number> {
        if (!processId) return Promise.reject(new Error("No process ID provided"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getEnvelopeHeight", processId })
            .catch((error) => {
                // TODO Refactor errors
                if (params.skipArchive || !error.message.includes("No data found for this key")) {
                    throw error
                }
                return GatewayArchiveApi.getProcess(processId, gateway, error.message)
                    .then(processArchiveData => GatewayArchive.mapToGetEnvelopeHeight(processArchiveData))
            })
            .then((response) => {
                if (!(typeof response.height === 'number') || response.height < 0) throw new Error("The gateway response is not correct")
                return response.height
            })
    }

    /**
     * Fetches the list of process ID's for a given entity
     * @param filters Optional criteria to filter the processes ID's given by the gateway
     * @param gateway
     */
    export async function getProcessList(filters: { entityId?: string, namespace?: number, status?: VochainProcessStatus, withResults?: boolean, from?: number } = {}, gateway: IGatewayDVoteClient): Promise<string[]> {
        if (!gateway) throw new Error("Invalid gateway client")
        else if (typeof filters != "object") throw new Error("Invalid filters parameter")

        const req: IRequestParameters = {
            method: "getProcessList",
            ...filters
        }
        if ('status' in filters) {
            req['status'] = VochainProcessStatus[filters.status]
        }

        try {
            const response = await gateway.sendRequest(req)
            if (!response || !Array.isArray(response.processList || [])) throw new Error("Invalid response")
            return response.processList || []
        }
        catch (err) {
            if (err?.message?.includes?.("Key not found")) return []
            throw err
        }
    }

    /**
     * Fetches the list of envelopes for a given processId
     * @param processId
     * @param from
     * @param listSize
     * @param gateway
     * @returns List of submitted votes envelopes
     */
    export function getEnvelopeList(processId: string,
        from: number, listSize: number, gateway: IGatewayDVoteClient): Promise<EnvelopeMeta[]> {
        if (!processId || isNaN(from) || isNaN(listSize) || !gateway)
            return Promise.reject(new Error("Invalid parameters"))

        return gateway.sendRequest({ method: "getEnvelopeList", processId, from, listSize })
            .then((response) => {
                return Array.isArray(response.envelopes) ? response.envelopes : []
            })
            .catch((error) => {
                const message = (error.message) ? "Could not retrieve the envelope list: " + error.message : "Could not retrieve the envelope list"
                throw new Error(message)
            })
    }

    // Results
    function fetchRawResults(processId: string, gateway: IGatewayClient, params: { skipArchive?: boolean } = {}): Promise<RawResults> {
        if (!processId)
            return Promise.reject(new Error("No process ID provided"))
        else if (!gateway)
            return Promise.reject(new Error("Invalid gateway client"))

        return gateway.sendRequest({ method: "getResults", processId })
            .catch((error) => {
                // TODO Refactor errors
                if (params.skipArchive || !error.message.includes("No data found for this key")) {
                    throw error
                }
                return GatewayArchiveApi.getProcess(processId, gateway, error.message)
                    .then(processArchiveData => GatewayArchive.mapToGetResults(processArchiveData))
            })
            .then((response) => {
                if (response.results && !Array.isArray(response.results)) throw new Error("The gateway response is not valid")
                const results = (Array.isArray(response.results) && response.results.length) ? response.results : []
                const status = response.state || ""
                const envelopHeight = response.height || 0
                return { results, status, envelopHeight }
            })
    }

    /**
     * Retrieves the results for a given processId. Resolved from the archive if needed.
     * @param processId
     * @param gateway
     * @returns Results, vote process  type, vote process state
     */
    export async function getResults(processId: string, gateway: IGatewayClient): Promise<RawResults> {
        if (!processId)
            throw new Error("No process ID provided")
        else if (!gateway)
            throw new Error("Invalid gateway client")

        processId = ensure0x(processId)
        const emptyResults: RawResults = { envelopHeight: 0, results: [], status: VochainProcessStatus.READY }

        try {
            const processState = await getProcessState(processId, gateway)
            if (processState.status == VochainProcessStatus.CANCELED) {
                emptyResults.status = processState.status
                return emptyResults
            }

            // Encrypted?
            let procKeys: ProcessKeys, retries: number
            const currentBlock = await getBlockHeight(gateway)
            if (processState.envelopeType.encryptedVotes) {
                if (currentBlock < processState.startBlock) return emptyResults // not started
                else if (processState.processMode["interruptible"]) {
                    if (processState.status !== VochainProcessStatus.RESULTS &&
                        processState.status !== VochainProcessStatus.ENDED &&
                        (currentBlock < processState.endBlock)) return emptyResults // not ended
                } else {
                    if (processState.status !== VochainProcessStatus.RESULTS &&
                        (currentBlock < processState.endBlock)) return emptyResults // not ended
                }

                retries = 3
                do {
                    procKeys = await getProcessKeys(processId, gateway)
                    if (procKeys && procKeys.encryptionPrivKeys && procKeys.encryptionPrivKeys.length) break

                    await VochainWaiter.wait(2, gateway)
                    retries--
                } while (retries >= 0)
                if (!procKeys || !procKeys.encryptionPrivKeys || !procKeys.encryptionPrivKeys.length) return emptyResults
            }

            return fetchRawResults(processId, gateway)
        }
        catch (err) {
            throw new ResultsNotAvailableError()
        }
    }

    /** Fetches the raw bytes of the WASM file used to generate the witness.
     * Depending on the census size, if chooses the right circuit to fetch.
     */
    export function fetchAnonymousWitnessGenerator(circuitInfo: ProcessCircuitInfo) {
        const uri = circuitInfo.uri + "/" + circuitInfo.circuitPath + "/" + ZK_VOTING_CIRCUIT_WASM_FILE_NAME
        const curi = new ContentHashedUri(uri + "!" + strip0x(circuitInfo.witnessHash))

        return FileApi.fetchBytes(curi).then(data => {
            return new Uint8Array(data)
        })
    }

    /** Fetches the raw bytes of the Proving key */
    export function fetchAnonymousVotingZKey(circuitInfo: ProcessCircuitInfo) {
        const uri = circuitInfo.uri + "/" + circuitInfo.circuitPath + "/" + ZK_VOTING_ZKEY_FILE_NAME
        const curi = new ContentHashedUri(uri + "!" + strip0x(circuitInfo.zKeyHash))

        return FileApi.fetchBytes(curi).then(data => {
            return new Uint8Array(data)
        })
    }

    /** Fetches the raw bytes of the Verification key */
    export function fetchAnonymousVotingVerificationKey(circuitInfo: ProcessCircuitInfo) {
        const uri = circuitInfo.uri + "/" + circuitInfo.circuitPath + "/" + ZK_VOTING_VERIFICATION_KEY_FILE_NAME
        const curi = new ContentHashedUri(uri + "!" + strip0x(circuitInfo.vKHash))

        return FileApi.fetchBytes(curi).then(data => {
            return new Uint8Array(data)
        })
    }

    ///////////////////////////////////////////////////////////////////////////////
    // VOCHAIN SETTERS
    ///////////////////////////////////////////////////////////////////////////////

    /**
     * Submit the vote envelope to a Gateway
     * @param {VoteEnvelope} voteEnvelope Instance of the VoteEnvelope protobuf model
     * @param {Wallet|Signer} walletOrSigner Set to `null` on ZK Snarks. The wallet to sign the envelope.
     * @param {Gateway|GatewayPool} gateway
     */
    export async function submitEnvelope(voteEnvelope: VoteEnvelope, walletOrSigner: Wallet | Signer | null, gateway: IGatewayDVoteClient): Promise<DVoteGatewayResponseBody> {
        if (typeof voteEnvelope != "object") return Promise.reject(new Error("The vote has to be a VoteEnvelope object"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        const tx = Tx.encode({ payload: { $case: "vote", vote: voteEnvelope } })
        const txBytes = tx.finish()

        let signature: Uint8Array
        if (voteEnvelope.proof.payload.$case == "zkSnark") {
            signature = new Uint8Array()
        }
        else {
            const hexSignature = await BytesSignature.sign(txBytes, walletOrSigner)
            signature = new Uint8Array(Buffer.from(strip0x(hexSignature), "hex"))
        }

        const signedTx = SignedTx.encode({ tx: txBytes, signature })
        const signedTxBytes = signedTx.finish()

        const base64Payload = Buffer.from(signedTxBytes).toString("base64")
        return gateway.sendRequest({ method: "submitRawTx", payload: base64Payload })
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
    export function getEnvelopeStatus(processId: string, nullifier: string | bigint, gateway: IGatewayDVoteClient): Promise<{ registered: boolean, date?: Date, block?: number }> {
        if (!processId || !nullifier) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

        if (typeof nullifier == "bigint") {
            nullifier = "0x" + bigIntToLeBuffer(nullifier).toString("hex")
        }

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
}
