// This file provides:
// - Typescript type definitions for ProcessMetadata objects
// - Metadata JSON validation checker
// - A metadata JSON template

import {
    HexString,
    // ContractAddress,
    // PublicKey,
    // PrivateKey,
    // ProcessId,
    MultiLanguage,
    // URI
} from "./common"
import { ProcessType } from "dvote-solidity"
import * as Joi from "joi-browser"
import { by639_1 } from 'iso-language-codes'
export { ProcessMetadataTemplate } from "./templates/voting-process"

// LOCAL TYPE ALIASES
type ContentUriString = string
type ContentHashedUriString = string
type MessagingUriString = string

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given metadata is valid.
 * Throws an exception if it is not.
 */
export function checkValidProcessMetadata(voteMetadata: ProcessMetadata): ProcessMetadata {
    if (typeof voteMetadata != "object") throw new Error("The metadata must be a JSON object")

    const result = Joi.validate(voteMetadata, voteMetadataSchema, { convert: true })
    if (!result || result.error) {
        throw new Error("Metadata validation error: " + result.error.toString())
    }
    return result.value
}

// INTERMEDIATE SCHEMAS

// Like { en: Joi.string(), fr: Joi.string, it: Joi.string, ... }
const strLangCodes = Object.keys(by639_1).reduce((prev, cur) => {
    prev[cur] = Joi.string()
    return prev
}, {})

const multiLanguageStringKeys = {
    ...strLangCodes,
    default: Joi.string().optional()
}

// MAIN ENTITY SCHEMA

const processTypes: ProcessType[] = ["snark-vote", "poll-vote", "encrypted-poll", "petition-sign"]
const questionTypes = ["single-choice"]

const voteMetadataSchema = Joi.object().keys({
    version: Joi.string().regex(/^[0-9]\.[0-9]$/).required(),
    type: Joi.string().valid(...processTypes).required(),
    startBlock: Joi.number().integer().min(0).required(),
    numberOfBlocks: Joi.number().integer().min(0).required(),
    census: Joi.object().keys({
        merkleRoot: Joi.string().regex(/^0x[a-z0-9]+$/).required(),
        merkleTree: Joi.string().required()
    }),
    details: {
        entityId: Joi.string().regex(/^0x[a-z0-9]+$/).required(),
        encryptionPublicKey: Joi.string().required(),
        title: Joi.object().keys(multiLanguageStringKeys).required(),
        description: Joi.object().keys(multiLanguageStringKeys).required(),
        headerImage: Joi.string().required(),
        streamUrl: Joi.string().allow("").optional(),
        questions: Joi.array().items(
            Joi.object().keys({
                type: Joi.string().valid(...questionTypes).required(),
                question: Joi.object().keys(multiLanguageStringKeys).required(),
                description: Joi.object().keys(multiLanguageStringKeys).required(),
                voteOptions: Joi.array().items(
                    Joi.object().keys({
                        title: Joi.object().keys(multiLanguageStringKeys).required(),
                        value: Joi.number().integer().required(),
                    })
                ).required()
            })
        ).required()
    }
}).unknown(true) // allow deprecated or unknown fields beyond the required ones

///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.0"
type QuestionType = "single-choice"
export { ProcessType }
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
        encryptionPublicKey: HexString,
        title: MultiLanguage<string>,
        description: MultiLanguage<string>,
        headerImage: ContentUriString,
        streamUrl?: ContentUriString,
        questions: Array<{
            type: QuestionType, // Defines how the UI should allow to choose among the votingOptions.
            question: MultiLanguage<string>,
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
