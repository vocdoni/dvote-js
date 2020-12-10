// This file provides:
// - Typescript type definitions for ProcessMetadata objects
// - Metadata JSON validation checker
// - A metadata JSON template

import {
    // HexString,
    MultiLanguage,
    ContentUriString,
} from "./common"
import { object, array, string, number } from "yup"
import { by639_1 } from 'iso-language-codes'
import { IProcessCreateParams } from "../net/contracts"

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
        headerImage: string().required(),
        streamUri: string().optional()
    }),
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
    ).required()
}).unknown(true) // allow deprecated or unknown fields beyond the required ones

///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.1"

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
    questions: Array<{
        title: MultiLanguage<string>,
        description?: MultiLanguage<string>,
        choices: Array<{
            title: MultiLanguage<string>,
            value: number
        }>,
    }>,
}

export type INewProcessParams = Omit<Omit<IProcessCreateParams, "metadata">, "questionCount">

export interface DigestedProcessResults {
    questions: DigestedProcessResultItem[],
}

export interface DigestedProcessResultItem {
    title: MultiLanguage<string>,
    voteResults: {
        title: MultiLanguage<string>,
        votes: number,
    }[],
}
