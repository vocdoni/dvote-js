// NOTE: This code is borrowed from dvote-solidity

import {
    ProcessContractMethods,
    ProcessesContractDefinition,
    // NamespaceContractMethods,
    // NamespacesContractDefinition,
    // TokenStorageProofContractDefinition,
    // TokenStorageProofContractMethods,

    ProcessEnvelopeType,
    IProcessEnvelopeType,
    ProcessMode,
    IProcessMode,
    IProcessCensusOrigin,
    ProcessCensusOrigin,
    ProcessContractParameters
} from "../../src/net/contracts"
import { Contract, ContractFactory } from "ethers"
import { TestAccount } from "../helpers/all-services"
import NamespaceBuilder from "./namespace"
import { assert } from "console"

import StorageProofsBuilder from "./storage-proofs"
import { Web3Gateway } from "../../src/net/gateway-web3"

// DEFAULT VALUES
export const DEFAULT_PREDECESSOR_INSTANCE_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_NAMESPACE = 0
export const DEFAULT_PROCESS_MODE = ProcessMode.make()
export const DEFAULT_ENVELOPE_TYPE = ProcessEnvelopeType.make()
export const DEFAULT_CENSUS_ORIGIN = ProcessCensusOrigin.OFF_CHAIN_TREE
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!0987654321"
export const DEFAULT_MERKLE_ROOT = "0x123456789"
export const DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI = "ipfs://1234,https://server/uri!1234567812345678"
export const DEFAULT_START_BLOCK = 12341234
export const DEFAULT_BLOCK_COUNT = 500000
export const DEFAULT_QUESTION_COUNT = 5
export const DEFAULT_MAX_VOTE_OVERWRITES = 0
export const DEFAULT_MAX_COUNT = 4
export const DEFAULT_MAX_VALUE = 5
export const DEFAULT_MAX_TOTAL_COST = 0
export const DEFAULT_COST_EXPONENT = 10000
export const DEFAULT_PARAMS_SIGNATURE = "0x1111111111111111111111111111111111111111111111111111111111111111"

// BUILDER
export default class ProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    predecessorInstanceAddress: string = DEFAULT_PREDECESSOR_INSTANCE_ADDRESS
    enabled: boolean = true
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    censusRoot: string = DEFAULT_MERKLE_ROOT
    censusUri: string = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
    startBlock: number = DEFAULT_START_BLOCK
    blockCount: number = DEFAULT_BLOCK_COUNT
    mode: IProcessMode = DEFAULT_PROCESS_MODE
    envelopeType: IProcessEnvelopeType = DEFAULT_ENVELOPE_TYPE
    censusOrigin: IProcessCensusOrigin = DEFAULT_CENSUS_ORIGIN
    questionCount: number = DEFAULT_QUESTION_COUNT
    maxVoteOverwrites: number = DEFAULT_MAX_VOTE_OVERWRITES
    maxCount: number = DEFAULT_MAX_COUNT
    maxValue: number = DEFAULT_MAX_VALUE
    maxTotalCost: number = DEFAULT_MAX_TOTAL_COST
    costExponent: number = DEFAULT_COST_EXPONENT
    namespace: number = DEFAULT_NAMESPACE
    namespaceAddress: string
    storageProofAddress: string
    oracleAddress: string
    paramsSignature: string = DEFAULT_PARAMS_SIGNATURE

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(processCount?: number): Promise<Contract & ProcessContractMethods> {
        if (this.predecessorInstanceAddress != DEFAULT_PREDECESSOR_INSTANCE_ADDRESS && processCount > 0) throw new Error("Unable to create " + processCount + " processes without a null parent, since the contract is inactive. Call .build(0) instead.")

        const deployAccount = this.accounts[0]
        const gw = new Web3Gateway(deployAccount.provider)

        let namespaceAddress = this.namespaceAddress
        if (!namespaceAddress) { // deploy a new one
            if (this.oracleAddress) {
                const namespaceInstance = await new NamespaceBuilder(this.accounts).withNamespace(this.namespace).withOracles([this.oracleAddress]).build()
                namespaceAddress = namespaceInstance.address

                assert(await namespaceInstance.isOracle(this.namespace, this.oracleAddress), "Not an oracle on the new namespace contract")
            }
            else {
                const namespaceInstance = await new NamespaceBuilder(this.accounts).build()
                namespaceAddress = namespaceInstance.address
            }
        }
        else if (this.oracleAddress) { // attach to it and add the oracle
            const namespaceInstance = await gw.getNamespacesInstance(deployAccount.wallet, namespaceAddress)
            const tx = await namespaceInstance.setNamespace(this.namespace, "dummy", "dummy-2", [], [this.oracleAddress])
            await tx.wait()

            assert(await namespaceInstance.isOracle(this.namespace, this.oracleAddress), "Not an oracle to the attached instance")
        }

        let storageProofAddress = this.storageProofAddress
        if (!storageProofAddress) {
            const storageProofInstance = await new StorageProofsBuilder(this.accounts).build()
            storageProofAddress = storageProofInstance.address
        }

        let contractInstance = await gw.deploy<ProcessContractMethods>(ProcessesContractDefinition.abi, ProcessesContractDefinition.bytecode, { wallet: deployAccount.wallet }, [this.predecessorInstanceAddress, namespaceAddress, storageProofAddress])
        contractInstance = contractInstance.connect(this.entityAccount.wallet) as Contract & ProcessContractMethods

        if (typeof processCount == "undefined") processCount = 1 // one by default

        for (let i = 0; i < processCount; i++) {
            const params = ProcessContractParameters.fromParams({
                mode: this.mode,
                envelopeType: this.envelopeType,
                censusOrigin: this.censusOrigin,
                metadata: this.metadata,
                censusRoot: this.censusRoot,
                censusUri: this.censusUri,
                startBlock: this.startBlock,
                blockCount: this.blockCount,
                questionCount: this.questionCount,
                maxCount: this.maxCount,
                maxValue: this.maxValue,
                maxVoteOverwrites: this.maxVoteOverwrites,
                maxTotalCost: this.maxTotalCost,
                costExponent: this.costExponent,
                namespace: this.namespace,
                paramsSignature: this.paramsSignature
            }).toContractParams()
            await contractInstance.newProcess(...params)
        }

        return contractInstance as Contract & ProcessContractMethods
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        if (!entityAccount) throw new Error("Empty entityAccount")

        this.entityAccount = entityAccount
        return this
    }
    withPredecessor(predecessorInstanceAddress: string) {
        if (!predecessorInstanceAddress) throw new Error("Empty predecessorInstanceAddress")

        this.predecessorInstanceAddress = predecessorInstanceAddress
        return this
    }
    disabled() {
        this.enabled = false
        return this
    }
    withMetadata(metadata: string) {
        if (!metadata) throw new Error("Empty metadata value")

        this.metadata = metadata
        return this
    }
    withMode(mode: IProcessMode) {
        this.mode = mode
        return this
    }
    withProcessEnvelopeType(envelopeType: IProcessEnvelopeType) {
        this.envelopeType = envelopeType
        return this
    }
    withProcessCensusOrigin(censusOrigin: IProcessCensusOrigin) {
        this.censusOrigin = censusOrigin
        return this
    }
    withStartBlock(startBlock: number) {
        this.startBlock = startBlock
        return this
    }
    withBlockCount(blockCount: number) {
        this.blockCount = blockCount
        return this
    }
    withQuestionCount(questionCount: number) {
        this.questionCount = questionCount
        return this
    }
    withMaxVoteOverwrites(maxVoteOverwrites: number) {
        this.maxVoteOverwrites = maxVoteOverwrites
        return this
    }
    withMaxCount(maxCount: number) {
        this.maxCount = maxCount
        return this
    }
    withMaxValue(maxValue: number) {
        this.maxValue = maxValue
        return this
    }
    withMaxTotalCost(maxTotalCost: number) {
        this.maxTotalCost = maxTotalCost
        return this
    }
    withCostExponent(costExponent: number) {
        this.costExponent = costExponent
        return this
    }
    withNamespace(namespace: number) {
        this.namespace = namespace
        return this
    }
    withNamespaceInstance(namespaceAddress: string) {
        this.namespaceAddress = namespaceAddress
        return this
    }
    withOracle(oracleAddress: string) {
        this.oracleAddress = oracleAddress
        return this
    }
    withParamsSignature(paramsSignature: string) {
        this.paramsSignature = paramsSignature
        return this
    }

    // STATIC

    static createDefaultProcess(contractInstance: Contract & ProcessContractMethods) {
        const params = ProcessContractParameters.fromParams({
            mode: DEFAULT_PROCESS_MODE,
            envelopeType: DEFAULT_ENVELOPE_TYPE,
            censusOrigin: DEFAULT_CENSUS_ORIGIN,
            metadata: DEFAULT_METADATA_CONTENT_HASHED_URI,
            censusRoot: DEFAULT_MERKLE_ROOT,
            censusUri: DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
            startBlock: DEFAULT_START_BLOCK,
            blockCount: DEFAULT_BLOCK_COUNT,
            questionCount: DEFAULT_QUESTION_COUNT,
            maxCount: DEFAULT_MAX_COUNT,
            maxValue: DEFAULT_MAX_VALUE,
            maxVoteOverwrites: DEFAULT_MAX_VOTE_OVERWRITES,
            maxTotalCost: DEFAULT_MAX_TOTAL_COST,
            costExponent: DEFAULT_COST_EXPONENT,
            namespace: DEFAULT_NAMESPACE,
            paramsSignature: DEFAULT_PARAMS_SIGNATURE
        }).toContractParams()
        return contractInstance.newProcess(...params).then(tx => tx.wait())
    }
}
