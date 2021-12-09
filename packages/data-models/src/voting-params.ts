import { MultiLanguage } from "@vocdoni/common"
import { IProcessCreateParams } from "@vocdoni/contract-wrappers"
import { BigNumber } from "@ethersproject/bignumber"
import { ProofCA_Type } from "./protobuf"
import { ProcessMetadata } from "./voting-meta"

export type INewProcessParams = Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata }
export type INewProcessErc20Params = Omit<Omit<INewProcessParams, "censusRoot">, "censusOrigin">

// Envelope and proofs

export type IProofArbo = { siblings: string, weight?: bigint }
export type IProofCA = { type: number, voterAddress: string, signature: string, weight?: bigint }
export type IProofEVM = { key: string, proof: string[], value: string, weight?: bigint }

type IProofCaSignatureType = {
    UNKNOWN: number,
    ECDSA: number,
    ECDSA_PIDSALTED: number,
    ECDSA_BLIND: number,
    ECDSA_BLIND_PIDSALTED: number
}
const ProofCaSignatureTypes = ProofCA_Type as IProofCaSignatureType
export { ProofCaSignatureTypes }

// Anonymous voting

export type ZkProof = {
    proof: {
        a: string[]
        b: string[][]
        c: string[]
        protocol: string
        // curve: <string>proof.curve || "bn128",
    },
    publicSignals: string[]
}

// Single choice results
export interface ProcessResultsSingleChoice {
    totalVotes: number,
    questions: SingleChoiceQuestionResults[],
}

export interface SingleChoiceQuestionResults {
    title: MultiLanguage<string>,
    voteResults: Array<{
        title: MultiLanguage<string>,
        votes: BigNumber,
    }>,
}

// Multiple choice results
export interface ProcessResultsSingleQuestion {
    totalVotes: number,
    title: MultiLanguage<string>,
    options: Array<{
        title: MultiLanguage<string>,
        votes: BigNumber
    }>
}
