// This file provides:
// - Typescript type definitions for EntityMetadata objects
// - Metadata JSON validation checker
// - A metadata JSON template

import {
    MultiLanguage,
    URI
} from "vocdoni-common" // TODO: Import from the new NPM package
import { object, array, string } from "yup"
import { by639_1 } from 'iso-language-codes'
export { EntityMetadataTemplate } from "./templates/entity"

// LOCAL TYPE ALIASES
type ContentUriString = string
type ContentHashedUriString = string

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given metadata is valid.
 * Throws an exception if it is not.
 */
export function checkValidEntityMetadata(entityMetadata: EntityMetadata) {
    if (typeof entityMetadata != "object") throw new Error("The metadata must be a JSON object")

    try {
        entityMetadataSchema.validateSync(entityMetadata)
        return entityMetadataSchema.cast(entityMetadata) as unknown as EntityMetadata
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
    default: string().optional(),
    ...strLangCodes
}

// MAIN ENTITY SCHEMA

const entityMetadataSchema = object().shape({
    version: string().matches(/^[0-9]\.[0-9]$/).required(),

    languages: array().of(string().matches(/^([a-z]{2}|default)$/)).required(), // TODO: remove default
    name: object().shape(multiLanguageStringKeys).required(),
    description: object().shape(multiLanguageStringKeys).required(),

    newsFeed: object().shape(multiLanguageStringKeys).required(),
    media: object().shape({
        avatar: string().required(),
        header: string().required(),
        logo: string()
    }),
    meta: object().optional(),
    actions: array().of(
        object().shape({
            // Common
            type: string().matches(/^(register|browser|submitMedia)$/),
            actionKey: string().required(),
            name: object().shape(multiLanguageStringKeys).required(),
            visible: string().required(),

            // Optional
            url: string().optional(),
            imageSources: array().of(
                object().shape({
                    type: string().matches(/^(front-camera|back-camera|gallery)$/).required(),
                    name: string().required(), // Arbitrary name to identify the data when the JSON is posted
                    orientation: string().matches(/^(portrait|landscape)$/).optional(), // Required when type != "gallery"
                    overlay: string().matches(/^(face|id-card-front|id-card-back)$/).optional(), // Required when type != "gallery"
                    caption: object().shape(multiLanguageStringKeys).optional()   // Required when type != "gallery"
                })
            ).optional(),
        })
    ).optional(),
}).unknown(true) // allow deprecated or unknown fields beyond the required ones


///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

type ProtocolVersion = "1.0"

/**
 * ENS keys used to store the Text Records on the Smart Contract
 */
export const TextRecordKeys = {
    JSON_METADATA_CONTENT_URI: "vnd.vocdoni.meta",
    VOCDONI_ARCHIVE: "vnd.vocdoni.archive",
    VOCDONI_BOOT_NODES: "vnd.vocdoni.boot-nodes",
    VOCDONI_GATEWAY_HEARTBEAT: "vnd.vocdoni.gateway-heartbeat",
}

/**
 * ENS keys used to store the Text List Records on the Smart Contract
 */
export const TextListRecordKeys = {
    // Not used currently
}

/**
 * JSON metadata. Intended to be stored on IPFS or similar.
 * More info: https://vocdoni.io/docs/#/architecture/components/entity?id=meta
 */
export interface EntityMetadata {
    version: ProtocolVersion,                // Protocol version
    languages: ["default"],                  // FIXME: Remove in favor of actual language codes
    // languages: string[],                  // Two character language code (en, fr, it, ...)

    name: MultiLanguage<string>,
    description: MultiLanguage<string>,

    newsFeed: MultiLanguage<ContentUriString>,

    media: {
        avatar: ContentUriString,
        header: ContentUriString,
        logo?: ContentUriString
    },
    meta?: {
        [key: string]: any
    },
    // List of custom interactions that the entity defines.
    // It may include anything like visiting web sites, uploading pictures, making payments, etc.
    actions?: Array<EntityCustomAction>,
}

export type EntityCustomAction = EntityBaseAction & (EntityRegisterAction | EntityBrowserAction | EntityImageUploadAction)

// The common fields of any action
interface EntityBaseAction {
    // type: string => overridden by subtypes

    // A name to identify this action when querying for visibility
    // and sending requests
    actionKey: string,

    // Localized Call To Action to appear on the app
    name: MultiLanguage<string>,

    // Endpoint to POST to with the publicKey and a signed timestamp
    // Returning a response with true as a value will show the action
    // Entering "always" instead of a URI will show it always
    visible: URI | "always"
}

// Open a register form within the client app
interface EntityRegisterAction {
    type: "register",

    // The URL to POST the provided data to
    url: URI
}

// Opening an interactive web browser
interface EntityBrowserAction {
    type: "browser",

    // The URI to navigate to
    url: URI
}

// App-driven image upload example
interface EntityImageUploadAction {
    type: "submitMedia",

    // Requested image types to provide
    imageSources: ImageUploadSource[],

    // Endpoint accepting POST requests with JSON payloads like:
    // {
    //   "field-name-1": "base64-image-payload",
    //   "another-field": "base64-image-payload",
    //   ...
    // }
    //
    // The URL to POST the provided data to
    url: URI
}

type ImageUploadSource = {
    type: "front-camera" | "back-camera" | "gallery",
    name: string,                            // Arbitrary name to identify the data when the JSON is posted
    orientation?: "portrait" | "landscape",  // Optional when type == "gallery"
    overlay?: "face" | "id-card-front" | "id-card-back",
    caption?: MultiLanguage<string>
}
