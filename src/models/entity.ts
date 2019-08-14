// This file provides:
// - Typescript type definitions for EntityMetadata objects
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
export function checkValidEntityMetadata(entityMetadata: EntityMetadata) {
    if (typeof entityMetadata != "object") throw new Error("The metadata must be a JSON object")

    const result = Joi.validate(entityMetadata, entityMetadataSchema)
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

const entityReferenceSchema = Joi.object().keys({
    resolverAddress: Joi.string().regex(/^0x[a-zA-Z0-9]{40}$/).required(),
    networkId: Joi.string().regex(/^[a-z]+$/).required(),
    entityId: Joi.string().regex(/^0x[a-z0-9]+$/).required()
})

// MAIN ENTITY SCHEMA

const entityMetadataSchema = Joi.object().keys({
    version: Joi.string().regex(/^[0-9]\.[0-9]$/).required(),
    entityId: Joi.string().regex(/^0x[a-z0-9]+$/).required(),

    languages: Joi.array().items(Joi.string().regex(/^([a-z]{2}|default)$/)).required(), // TODO: remove default
    name: Joi.object().keys(multiLanguageStringKeys).required(),
    description: Joi.object().keys(multiLanguageStringKeys).required(),

    contracts: Joi.object().keys({
        resolverAddress: Joi.string().regex(/^0x[a-zA-Z0-9]{40}$/).required(),
        votingAddress: Joi.string().regex(/^0x[a-zA-Z0-9]{40}$/).required(),
        networkId: Joi.string().regex(/^[a-z]+$/).required()
    }).required(),
    votingProcesses: Joi.object().keys({
        active: Joi.array().items(Joi.string().regex(/^0x[a-z0-9]+$/)).required(),
        ended: Joi.array().items(Joi.string().regex(/^0x[a-z0-9]+$/)).required()
    }).required(),

    newsFeed: Joi.object().keys(multiLanguageStringKeys).required(),
    media: Joi.object().keys({
        avatar: Joi.string().required(),
        header: Joi.string().required(),
    }),

    actions: Joi.array().items(
        Joi.object().keys({
            // Common
            type: Joi.string().regex(/^(browser|image)$/),
            name: Joi.object().keys(multiLanguageStringKeys).required(),
            visible: Joi.string().required(),

            // Optional
            url: Joi.string().optional(),
            register: Joi.boolean().optional(),
            imageSources: Joi.array().items(
                Joi.object().keys({
                    type: Joi.string().regex(/^(front-camera|back-camera|gallery)$/).required(),
                    name: Joi.string().required(), // Arbitrary name to identify the data when the JSON is posted
                    orientation: Joi.string().regex(/^(portrait|landscape)$/).optional(), // Required when type != "gallery"
                    overlay: Joi.string().regex(/^(face|id-card-front|id-card-back)$/).optional(), // Required when type != "gallery"
                    caption: Joi.object().keys(multiLanguageStringKeys).optional()   // Required when type != "gallery"
                })
            ).optional(),
        })
    ).required(),

    gatewayBootNodes: Joi.array().items(
        Joi.object().keys({
            fetchUri: Joi.string().required(),
            heartbeatMessagingUri: Joi.string().required()
        }),
    ).required(),

    gatewayUpdate: Joi.object().keys({
        timeout: Joi.number().integer().min(10000), // milliseconds
        topic: Joi.string().required(),
        difficulty: Joi.number().integer().min(0)
    }).required(),

    bootEntities: Joi.array().items(entityReferenceSchema).required(),

    fallbackBootNodeEntities: Joi.array().items(entityReferenceSchema).required(),

    trustedEntities: Joi.array().items(entityReferenceSchema).required(),

    censusServiceManagedEntities: Joi.array().items(entityReferenceSchema).required()
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
    VOCDONI_BOOT_NODES: "vnd.vocdoni.boot"
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
    entityId: string,
    languages: ["default"], // FIXME: Remove in favor of actual language codes
    // languages: string[],                  // Two character language code (en, fr, it, ...)

    name: MultiLanguage<string>,
    description: MultiLanguage<string>,

    newsFeed: MultiLanguage<ContentURI>,
    contracts: {
        resolverAddress: ContractAddress,
        votingAddress: ContractAddress,
        networkId: string,
    },
    votingProcesses: {
        active: ProcessId[],  // Process ID's to query on the Voting Contract
        ended: ProcessId[]
    },
    media: {
        avatar: ContentURI,
        header: ContentURI
    },

    // List of custom interactions that the entity defines.
    // It may include anything like visiting web sites, uploading pictures, making payments, etc.
    actions: EntityCustomAction[],

    // Entity's boot nodes providing a list of active Gateways
    gatewayBootNodes: GatewayBootNode[],
    gatewayUpdate: {
        timeout: number,                  // milliseconds after which a Gateway is marked as down
        topic: string,                    // Topic used for the messaging protocol (e.g. "vocdoni-gateway-update")
        difficulty: number                // Difficulty of the proof of work, to prevent spammers
    },

    bootEntities: EntityReference[],
    fallbackBootNodeEntities: EntityReference[],
    trustedEntities: EntityReference[],
    censusServiceManagedEntities: EntityReference[],
}

interface GatewayBootNode {
    fetchUri: URI,                          // Where to fetch the Bootnode Gateways
    heartbeatMessagingUri: MessagingURI     // Where Gateways should report their status updates
}

export type EntityCustomAction = EntityBaseAction & (EntityBrowserAction | EntityImageUploadAction)

// The common fields of any action
interface EntityBaseAction {
    // Localized Call To Action to appear on the app
    name: MultiLanguage<string>,

    // Endpoint to POST to with the publicKey and a signed timestamp
    // Returning a response with true as a value will show the action
    // Entering "always" instead of a URI will show it always
    visible: URI | "always"
}

// Opening an interactive web browser
interface EntityBrowserAction {
    type: "browser",
    register: boolean,

    // The URI to navigate to
    // - The embedded web site can send messages to the host app
    // - Messages can request the public key, or a signature
    url: URI
}

// App-driven image upload example
interface EntityImageUploadAction {
    type: "image",

    // Requested image types to provide
    imageSources: ImageUploadSource[],

    // Endpoint accepting POST requests with JSON payloads like:
    // {
    //   "field-name-1": "base64-image-payload",
    //   "another-field": "base64-image-payload",
    //   ...
    // }
    //
    // The URI will receive the following query string parameters:
    // - signature = sign(hash(jsonBody), privateKey)
    // - publicKey
    url: URI
}

type ImageUploadSource = {
    type: "front-camera" | "back-camera" | "gallery",
    name: string,                            // Arbitrary name to identify the data when the JSON is posted
    orientation?: "portrait" | "landscape",  // Optional when type == "gallery"
    overlay?: "face" | "id-card-front" | "id-card-back",
    caption?: MultiLanguage<string>
}

type EntityReference = {
    resolverAddress: ContractAddress,
    networkId: string,
    entityId: HexString
}

///////////////////////////////////////////////////////////////////////////////
// JSON TEMPLATE
///////////////////////////////////////////////////////////////////////////////

export const EntityMetadataTemplate: EntityMetadata = {
    version: "1.0",
    entityId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    languages: [
        "default"
    ],
    name: {
        default: "My official entity",
        // fr: "Mon organisation officielle"
    },
    description: {
        default: "The description of my entity goes here",
        // fr: "La description officielle de mon organisation est ici"
    },
    contracts: {
        "resolverAddress": "0x21f7DcCd9D1ce4C3685A5c50096265A8db4103b4",
        "votingAddress": "0x1234567890123456789012345678901234567890",
        "networkId": "goerli"
    },
    votingProcesses: {
        active: [],
        ended: []
    },
    newsFeed: {
        default: "https://hipsterpixel.co/feed.json",
        // fr: "https://feed2json.org/convert?url=http://www.intertwingly.net/blog/index.atom"
    },
    media: {
        avatar: "https://host/image.png",
        header: "https://host/image.png"
    },
    actions: [
        {
            type: "browser",
            register: true,
            name: {
                default: "Sign up",
                // fr: "S'inscrire"
            },
            url: "https://registry.vocdoni.net/register.html?entityId=0x0",
            visible: "https://registry.vocdoni.net/api/actions/status"
        }
    ],
    gatewayBootNodes: [],
    gatewayUpdate: {
        timeout: 60000,
        topic: "vocdoni-gateway-update",
        difficulty: 1000
    },
    bootEntities: [],
    fallbackBootNodeEntities: [],
    trustedEntities: [],
    censusServiceManagedEntities: []
}
