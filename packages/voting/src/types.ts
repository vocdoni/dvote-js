import { ProcessCensusOrigin } from "@vocdoni/contract-wrappers"
import {
    VochainCensusOrigin,
    VochainProcessStatus,
    SourceNetworkId,
} from "@vocdoni/data-models"
import { ProcessMetadata, IProofEVM, IProofCA, IProofArbo, ZkProof } from "@vocdoni/data-models"

export type VoteValues = Array<number | bigint>

export type VotePackage = {
    nonce: string, // (optional) random number to prevent guessing the encrypted payload before the key is revealed
    votes: VoteValues  // Directly mapped to the `questions` field of the metadata
}

export type SignedEnvelopeParams = {
    censusOrigin: number | ProcessCensusOrigin,
    votes: VoteValues,
    processId: string,
    censusProof: IProofArbo | IProofCA | IProofEVM,
    processKeys?: ProcessKeys,
    /** hex string */
}

export type AnonymousEnvelopeParams = {
    /** Serialized votePackage */
    votePackage: Uint8Array,
    processId: string,
    zkProof: ZkProof,
    nullifier: bigint,
    circuitIndex: number,
    encryptionKeyIndexes?: number[]
}
export interface BlockStatus {
    /** The current block height */
    blockNumber: number,
    /** The timestamp at which the block was mined */
    blockTimestamp: number,
    /** The average block times during the last minute, 10m, 1h, 6h and 24h */
    blockTimes: number[]
}

/** Contains the flag for knowing if a process has been archived */
export type ProcessArchive = {
    archived?: boolean,
    startDate?: Date,
    endDate?: Date
}

/** Contains the full details of a process, including the human readable metadata and the on-chain flags */
export type ProcessDetails = {
    id: string
    metadata: ProcessMetadata
    state: ProcessState
}

/** Contains the current state of a process on the Vochain */
export type ProcessState = ProcessArchive & {
    censusOrigin: VochainCensusOrigin,
    censusRoot: string,
    censusURI: string,
    rollingCensusRoot: string,
    metadata: string,
    /** Example: 2021-05-12T15:52:10-05:00 */
    creationTime: string,
    startBlock: number,
    endBlock: number,
    /** The Ethereum address of the entity holding the process */
    entityId: string,
    /** The index of the current process within the entity's list */
    entityIndex: number,
    envelopeType: {
        serial?: boolean,
        anonymous?: boolean,
        encryptedVotes?: boolean,
        uniqueValues?: boolean,
        costFromWeight?: boolean
    },
    finalResults: boolean,
    haveResults: boolean,
    namespace: number,
    processId: string,
    processMode: {
        autoStart?: boolean,
        interruptible?: boolean,
        dynamicCensus?: boolean,
        encryptedMetadata?: boolean,
        preRegister?: boolean
    },
    questionIndex: number,
    sourceBlockHeight: number,
    status: VochainProcessStatus,
    voteOptions: {
        costExponent: number,
        maxCount: number,
        maxValue: number,
        maxTotalCost?: number,
        maxVoteOverwrites: number
    }
}

/** Contains a summary of the most relevant process details */
export type ProcessSummary =
    Pick<ProcessState, "entityId" | "status" | "startBlock" | "endBlock" | "archived" | "startDate" | "endDate" | "envelopeType" | "entityIndex"> & {
        /** The amount of votes registered */
        envelopeHeight: number
        /** The IPFS URI pointing to the JSON metadata file */
        metadata: string
        /** The origin from which the process was created */
        sourceNetworkId: keyof typeof SourceNetworkId
    }

export type ProcessKeys = {
    encryptionPubKeys: { idx: number, key: string }[],
    encryptionPrivKeys?: { idx: number, key: string }[],
    commitmentKeys?: { idx: number, key: string }[],
    revealKeys?: { idx: number, key: string }[]
}

export type ProcessCircuitInfo = {
    /** Circuit index */
    index: number,
    /** Base URI to fetch from */
    uri: string
    /** Relative path where the circuit is hosted */
    circuitPath: string
    /** Maximum census size supported by the circuit */
    maxSize: number
    /** Base64 */
    witnessHash: string
    /** Base64 */
    zKeyHash: string
    /** Base64 */
    vKHash: string
}

export type EnvelopeMeta = {
    height: number,
    nullifier: string,
    process_id: string,
    tx_hash: string,
    tx_index: number
}

export type EnvelopeFull = {
    meta: EnvelopeMeta,
    nonce: string,
    signature: string,
    vote_package: string,
    weight: string
}

export type RawResults = {
    results: string[][],
    status: VochainProcessStatus,
    envelopHeight: number
}
