import * as Joi from "@hapi/joi"
import { by639_1 } from 'iso-language-codes'
import { EntityMetadata } from "./metadata-types"

// VALIDATORS

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
    resolverAddress: Joi.string().regex(/^0x[a-z0-9]{40}$/).required(),
    entityId: Joi.string().regex(/^0x[a-z0-9]+$/).required(),
})

// MAIN ENTITY SCHEMA

const entityMetadataSchema = Joi.object().keys({
    version: Joi.string().regex(/^[0-9]\.[0-9]$/).required(),
    languages: Joi.array().items(Joi.string().regex(/^([a-z]{2}|default)$/)).required(), // TODO: remove default
    name: Joi.object().keys(multiLanguageStringKeys).required(),
    description: Joi.object().keys(multiLanguageStringKeys).required(),

    votingContract: Joi.string().regex(/^0x[a-z0-9]{40}$/).required(),
    votingProcesses: Joi.object().keys({
        active: Joi.array().items(Joi.string().regex(/^0x[a-z0-9]+$/)).required(),
        ended: Joi.array().items(Joi.string().regex(/^0x[a-z0-9]+$/)).required()
    }).required(),
    newsFeed: Joi.object().keys(multiLanguageStringKeys).required(),
    avatar: Joi.string().required(),

    actions: Joi.array().items(
        Joi.object().keys({
            // Common
            type: Joi.string().regex(/^(browser|image)$/),
            name: Joi.object().keys(multiLanguageStringKeys).required(),
            visible: Joi.alternatives([Joi.string(), Joi.boolean()]).required(),

            // Optional
            url: Joi.string().optional(),
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
            heartbeatMessagingUri: Joi.string().required(),
            fetchUri: Joi.string().required()
        }),
    ).required(),

    gatewayUpdate: Joi.object().keys({
        timeout: Joi.number().integer().min(10000), // milliseconds
        topic: Joi.string().required(),
        difficulty: Joi.number().integer().min(0)
    }).required(),

    relays: Joi.array().items(
        Joi.object().keys({
            publicKey: Joi.string().regex(/^[a-z0-9]{130}$/).required(),
            messagingUri: Joi.string().required()
        }),
    ).required(),

    bootEntities: Joi.array().items(entityReferenceSchema).required(),

    fallbackBootNodeEntities: Joi.array().items(entityReferenceSchema).required(),

    trustedEntities: Joi.array().items(entityReferenceSchema).required(),

    censusServiceManagedEntities: Joi.array().items(entityReferenceSchema).required()
})

