// This file provides:
// - Typescript type definitions for JsonFeed objects
// - Metadata JSON validation checker
// - A metadata JSON template

import * as Joi from "joi-browser"

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
    home_page_url: Joi.string(),
    description: Joi.string(),
    feed_url: Joi.string(),
    icon: Joi.string(),
    favicon: Joi.string(),
    expired: Joi.boolean(),

    items: Joi.array().items(
        Joi.object({
            id: Joi.string().optional(),
            title: Joi.string(),
            summary: Joi.string(),
            content_text: Joi.string(),
            content_html: Joi.string(),
            url: Joi.string().optional(),
            image: Joi.string(),
            tags: Joi.array().items(Joi.string()).optional(),
            date_published: Joi.string(),
            date_modified: Joi.string(),
            author: Joi.object({
                name: Joi.string(),
                url: Joi.string()
            }).optional()
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
    expired?: boolean,

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
    date_published?: string,
    date_modified?: string,
    author?: {
        name?: string,
        url?: string
    }
}

///////////////////////////////////////////////////////////////////////////////
// JSON TEMPLATE
///////////////////////////////////////////////////////////////////////////////

export const JsonFeedTemplate: JsonFeed = {
    version: "1.0",
    title: "Example",
    home_page_url: "http://www.com",
    description: "This is the description",
    feed_url: "http://www.com/item.json",
    icon: "http://www.com/icon.png",
    favicon: "http://www.com/favicon.ico",
    expired: false,

    items: [{
        id: "1234",
        title: "Hello world",
        summary: "Summary 1, 2, 3",
        content_text: "Once upon a time, there was a JSON Feed...",
        content_html: "<p>Once upon a time, there was a JSON Feed...</p>",
        url: "http://link.item/1234",
        image: "http://www.com/image.jpg",
        tags: ["hello", "world"],
        date_published: "2010-02-07T14:04:00-05:00",
        date_modified: "2010-02-07T14:04:00-05:00",
        author: {
            name: "John Smith",
            url: "http://john.smith"
        }
    }]
}
