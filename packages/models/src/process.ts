// This file provides:
// - Typescript type definitions for ProcessMetadata objects
// - Metadata JSON validation checker
// - A metadata JSON template
// - Enum's for vote envelopes

import {
    // HexString,
    MultiLanguage,
    ContentUriString,
} from "../../common/src" // TODO: Import from the new NPM package
import { object, array, string, number } from "yup"
import { by639_1 } from 'iso-language-codes'
import { IProcessCreateParams } from "../../net/src" // TODO: Import from the new NPM package
import { BigNumber } from "@ethersproject/bignumber"
import { ProofCA_Type } from "./protobuf"

export { ProcessMetadataTemplate } from "./templates/process"

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given metadata is valid.
 * Throws an exception if it is not.
 */
export function checkValidProcessMetadata(processMetadata: ProcessMetadata): ProcessMetadata {
    if (typeof processMetadata != "object") throw new Error("The metadata must be a JSON object")
    else if (processMetadata.questions.length < 1)
        throw new Error("The metadata needs to have at least one question")
    else if (processMetadata.questions.some(q => !Array.isArray(q.choices) || q.choices.length < 2))
        throw new Error("All questions need to have at least two choices")

    try {
        processMetadataSchema.validateSync(processMetadata)
        return processMetadataSchema.cast(processMetadata) as ProcessMetadata
    }
    catch (err) {
        if (Array.isArray(err.errors)) throw new Error("ValidationError: " + err.errors.join(", "))
        throw err
    }
}

// INTERMEDIATE SCHEMAS

// Like { en: string(), fr: string, it: string, ... }
const strLangCodes = Object.keys(by639_1).reduce((prev, cur) => {
    prev[cur] = string().optional()
    return prev
}, {})

const multiLanguageStringKeys = {
    ...strLangCodes,
    default: string().optional()
}

// MAIN ENTITY SCHEMA

const processMetadataSchema = object().shape({
    version: string().matches(/^[0-9]\.[0-9]$/).required(),
    title: object().shape(multiLanguageStringKeys).required(),
    description: object().shape(multiLanguageStringKeys).required(),
    media: object().shape({
        header: string().required(),
        streamUri: string().optional()
    }),
    meta: object().optional(),
    questions: array().of(
        object().shape({
            title: object().shape(multiLanguageStringKeys).required(),
            description: object().shape(multiLanguageStringKeys).optional(),
            choices: array().of(
                object().shape({
                    title: object().shape(multiLanguageStringKeys).required(),
                    value: number().integer().required()
                })
            ).required()
        })
    ).required(),
    results: object().shape({
        aggregation: string().required().oneOf(["index-weighted", "discrete-counting"]),
        display: string().required().oneOf(["rating", "simple-question", "multiple-choice", "linear-weighted", "quadratic-voting", "multiple-question", "raw"]),
    }).required()
}).unknown(true) // allow deprecated or unknown fields beyond the required ones

///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.1"

export type ProcessResultsAggregation = "index-weighted" | "discrete-counting"
export type ProcessResultsDisplay = "rating" | "simple-question" | "multiple-choice" | "linear-weighted" | "quadratic-voting" | "multiple-question" | "raw"

/**
 * JSON metadata. Intended to be stored on IPFS or similar.
 * More info: https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 */
export interface ProcessMetadata {
    version: ProtocolVersion, // Version of the metadata schema used
    title: MultiLanguage<string>,
    description: MultiLanguage<string>,
    media: {
        header: ContentUriString,
        streamUri?: string
    },
    /** Arbitrary key/value data that specific applications can use for their own needs */
    meta?: any,
    questions: Array<{
        title: MultiLanguage<string>,
        description?: MultiLanguage<string>,
        choices: Array<{
            title: MultiLanguage<string>,
            value: number
        }>,
    }>,
    results: {
        aggregation: ProcessResultsAggregation,
        display: ProcessResultsDisplay
    }
}

export type INewProcessParams = Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata }
export type INewProcessErc20Params = Omit<Omit<INewProcessParams, "censusRoot">, "censusOrigin">

// Single choice
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

// Multiple choice
export interface ProcessResultsSingleQuestion {
    totalVotes: number,
    title: MultiLanguage<string>,
    options: Array<{
        title: MultiLanguage<string>,
        votes: BigNumber
    }>
}

// Envelope and proofs

export type IProofArbo = string
export type IProofCA = { type: number, voterAddress: string, signature: string }
export type IProofEVM = { key: string, proof: string[], value: string }

type IProofCaSignatureType = {
    UNKNOWN: number,
    ECDSA: number,
    ECDSA_PIDSALTED: number,
    ECDSA_BLIND: number,
    ECDSA_BLIND_PIDSALTED: number
}
const ProofCaSignatureTypes = ProofCA_Type as IProofCaSignatureType
export { ProofCaSignatureTypes }
