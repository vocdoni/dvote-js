// This file provides:
// - Typescript type definitions for JsonFeed objects
// - Metadata JSON validation checker
// - A metadata JSON template

import * as Joi from "joi-browser"
export { JsonFeedTemplate } from "./templates/json-feed"

// LOCAL TYPE ALIASES
type ContentUriString = string
type ContentHashedUriString = string
type MessagingUriString = string

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given JSON Feed is valid.
 * Throws an exception if it is not.
 */
export function checkValidJsonFeed(jsonFeed: JsonFeed) {
    if (typeof jsonFeed != "object") throw new Error("The metadata must be a JSON object")

    const result = Joi.validate(jsonFeed, jsonFeedSchema)
    if (!result || result.error) {
        throw new Error("JSON Feed validation error: " + result.error.toString())
    }
    return result.value
}

// MAIN ENTITY SCHEMA

const jsonFeedSchema = Joi.object({
    version: Joi.string(),
    title: Joi.string(),
    home_page_url: Joi.string().allow("").optional(),
    description: Joi.string().allow("").optional(),
    feed_url: Joi.string().allow("").optional(),
    icon: Joi.string().allow("").optional(),
    favicon: Joi.string().allow("").optional(),
    expired: Joi.boolean(),

    items: Joi.array().items(
        Joi.object({
            id: Joi.string().allow("").optional(),
            title: Joi.string(),
            summary: Joi.string().allow("").optional(),
            content_text: Joi.string(),
            content_html: Joi.string(),
            url: Joi.string().optional(),
            image: Joi.string().allow("").optional(),
            tags: Joi.array().items(Joi.string()).optional(),
            date_published: Joi.string(),
            date_modified: Joi.string(),
            author: Joi.object({
                name: Joi.string().allow("").optional(),
                url: Joi.string().allow("").optional(),
            }).optional(),
        })
    )
}).unknown(true).options({ stripUnknown: true }) // allow deprecated or unknown fields beyond the required ones

///////////////////////////////////////////////////////////////////////////////
// TYPE DEFINITIONS
///////////////////////////////////////////////////////////////////////////////

/**
 * JSON Feed. Intended to be stored on IPFS or similar.
 * More info: https://jsonfeed.org/version/1
 */
export interface JsonFeed {
    version: string,
    title: string,
    home_page_url?: string,
    description?: string,
    feed_url?: string,
    icon?: string,
    favicon?: string,
    expired: boolean,

    items: JsonFeedPost[]
}

export interface JsonFeedPost {
    id?: string,
    title: string,
    summary?: string,
    content_text?: string,
    content_html?: string,
    url?: string,
    image?: string,
    tags?: string[],
    date_published: string,
    date_modified: string,
    author?: {
        name?: string,
        url: string
    }
}
