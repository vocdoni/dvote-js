// This file provides:
// - Typescript type definitions for VotingProcess objects
// - Metadata JSON validation checker
// - A metadata JSON template

import {
    HexString,
    ContractAddress,
    PublicKey,
    // PrivateKey,
    ProcessId,
    MultiLanguage,
    ContentURI,
    MessagingURI,
    URI
} from "./common"
import * as Joi from "joi-browser"
import { by639_1 } from 'iso-language-codes'

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given metadata is valid.
 * Throws an exception if it is not.
 */
export function checkValidVotingProcess(voteMetadata: VotingProcess) {
    if (typeof voteMetadata != "object") throw new Error("The metadata must be a JSON object")

    const result = Joi.validate(voteMetadata, voteMetadataSchema)
    if (!result || result.error) {
        throw new Error("Metadata validation error: " + result.error.toString())
    }
}

// INTERMEDIATE SCHEMAS

// Like { en: Joi.string(), fr: Joi.string, it: Joi.string, ... }
const strLangCodes = Object.keys(by639_1).reduce((prev, cur) => {
    prev[cur] = Joi.string()
    return prev
}, {})

const multiLanguageStringKeys = {
    default: Joi.string().optional(),
    ...strLangCodes
}

// MAIN ENTITY SCHEMA

const voteMetadataSchema = Joi.object().keys({
    // TODO: complete the schema
})


///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.0"

/**
 * JSON metadata. Intended to be stored on IPFS or similar.
 * More info: https://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 */
export interface VotingProcess {
    // TODO: complete the schema
}

///////////////////////////////////////////////////////////////////////////////
// JSON TEMPLATE
///////////////////////////////////////////////////////////////////////////////

export const VotingProcessTemplate: VotingProcess = {
    // TODO: complete the schema
}
