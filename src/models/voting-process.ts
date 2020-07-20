// This file provides:
// - Typescript type definitions for ProcessMetadata objects
// - Metadata JSON validation checker
// - A metadata JSON template

import {
    HexString,
    MultiLanguage,
    ContentUriString,
    ContentHashedUriString
} from "./common"
import { object, array, string, number } from "yup"
import { by639_1 } from 'iso-language-codes'

export { ProcessMetadataTemplate } from "./templates/voting-process"


///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given metadata is valid.
 * Throws an exception if it is not.
 */
export function checkValidProcessMetadata(voteMetadata: ProcessMetadata): ProcessMetadata {
    if (typeof voteMetadata != "object") throw new Error("The metadata must be a JSON object")

    try {
        voteMetadataSchema.validateSync(voteMetadata)
        return voteMetadataSchema.cast(voteMetadata) as ProcessMetadata
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

const processTypes: string[] = ["snark-vote", "poll-vote", "encrypted-poll", "petition-sign"]
const questionTypes = ["single-choice"]

const voteMetadataSchema = object().shape({
    version: string().matches(/^[0-9]\.[0-9]$/).required(),
    type: string().oneOf(processTypes).required(),
    startBlock: number().integer().min(0).required(),
    numberOfBlocks: number().integer().min(0).required(),
    census: object().shape({
        merkleRoot: string().matches(/^0x[a-z0-9]+$/).required(),
        merkleTree: string().required()
    }),
    details: object().shape({
        entityId: string().matches(/^0x[a-z0-9]+$/).required(),
        title: object().shape(multiLanguageStringKeys).required(),
        description: object().shape(multiLanguageStringKeys).required(),
        headerImage: string().required(),
        streamUrl: string().optional(),
        questions: array().of(
            object().shape({
                type: string().oneOf(questionTypes).required(),
                question: object().shape(multiLanguageStringKeys).optional(),
                description: object().shape(multiLanguageStringKeys).required(),
                voteOptions: array().of(
                    object().shape({
                        title: object().shape(multiLanguageStringKeys).required(),
                        value: number().integer().required(),
                    })
                ).required()
            })
        ).required()
    })
}).unknown(true) // allow deprecated or unknown fields beyond the required ones

///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.0"
type QuestionType = "single-choice"
export type ProcessType = "snark-vote" | "poll-vote" | "encrypted-poll" | "petition-sign"
export type VochainProcessState = "scheduled" | "active" | "paused" | "finished" | "canceled"

/**
 * JSON metadata. Intended to be stored on IPFS or similar.
 * More info: https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 */
export interface ProcessMetadata {
    version: ProtocolVersion, // Version of the metadata schema used
    type: ProcessType, // details depends on the type
    startBlock: number, // Block number on the votchain since the process will be open
    numberOfBlocks: number,
    census: {
        merkleRoot: HexString,
        merkleTree: ContentHashedUriString
    },
    details: {
        entityId: HexString,
        title: MultiLanguage<string>,
        description: MultiLanguage<string>,
        headerImage: ContentUriString,
        streamUrl?: ContentUriString,
        questions: Array<{
            type: QuestionType, // Defines how the UI should allow to choose among the votingOptions.
            question?: MultiLanguage<string>,
            description: MultiLanguage<string>,
            voteOptions: Array<{
                title: MultiLanguage<string>,
                value: number
            }>,
        }>,
    }
}

export interface ProcessResults {
    questions: ProcessResultItem[],
}

export interface ProcessResultItem {
    type: QuestionType, // Defines how the UI should allow to choose among the votingOptions.
    question: MultiLanguage<string>,
    voteResults: Array<{
        title: MultiLanguage<string>,
        votes: number,
    }>,
}
