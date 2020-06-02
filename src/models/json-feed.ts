// This file provides:
// - Typescript type definitions for JsonFeed objects
// - Metadata JSON validation checker
// - A metadata JSON template

import { object, array, string, bool } from "yup"
export { JsonFeedTemplate } from "./templates/json-feed"

///////////////////////////////////////////////////////////////////////////////
// VALIDATION
///////////////////////////////////////////////////////////////////////////////

/**
 * Asserts that the given JSON Feed is valid.
 * Throws an exception if it is not.
 */
export function checkValidJsonFeed(jsonFeed: JsonFeed) {
    if (typeof jsonFeed != "object") throw new Error("The metadata must be a JSON object")

    try {
        jsonFeedSchema.validateSync(jsonFeed)
        return jsonFeedSchema.cast(jsonFeed) as JsonFeed
    }
    catch (err) {
        if (Array.isArray(err.errors)) throw new Error("ValidationError: " + err.errors.join(", "))
        throw err
    }
}

// MAIN ENTITY SCHEMA

const jsonFeedSchema = object({
    version: string(),
    title: string(),
    home_page_url: string().optional(),
    description: string().optional(),
    feed_url: string().optional(),
    icon: string().optional(),
    favicon: string().optional(),
    expired: bool(),

    items: array().of(
        object({
            id: string().optional(),
            title: string(),
            summary: string().optional(),
            content_text: string(),
            content_html: string(),
            url: string().optional(),
            image: string().optional(),
            tags: array().of(string()).optional(),
            date_published: string(),
            date_modified: string(),
            author: object({
                name: string().optional(),
                url: string().optional(),
            }).optional(),
        })
    )
}).unknown(true) // allow deprecated or unknown fields beyond the required ones

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
