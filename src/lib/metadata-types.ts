type ProtocolVersion = "1.0"
type HexString = string
type ContractAddress = HexString     // e.g. 0x1234567890123456789012345678901234567890
type PublicKey = HexString           // Uncompressed ECDSA public key
type PrivateKey = HexString
type ProcessId = HexString           // Hash of the organizer's address and the nonce of the process

type MultiLanguage<T> = {
    default: T
    // FIXME: Use language codes in the future
    // [lang: string]: T                // Indexed by language  { en: value, fr: value, ... }
}

type ContentURI = string             // Comma-separated list of URI's (http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=content-uri)
type MessagingURI = string           // Comma-separated list of URI's (http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=messaging-uri)
type URL = string

///////////////////////////////////////////////////////////////////////////////
// ENTITY METADATA
///////////////////////////////////////////////////////////////////////////////

/**
 * ENS keys used to store the Text Records on the Smart Contract
 */
export const TextRecordKeys = {
    LANGUAGES: "vnd.vocdoni.languages",
    JSON_METADATA_CONTENT_URI: "vnd.vocdoni.meta",
    VOTING_CONTRACT_ADDRESS: "vnd.vocdoni.voting-contract",
    GATEWAYS_UPDATE_CONFIG: "vnd.vocdoni.gateway-update",
    ACTIVE_PROCESS_IDS: "vnd.vocdoni.process-ids.active",
    ENDED_PROCESS_IDS: "vnd.vocdoni.process-ids.ended",
    AVATAR_CONTENT_URI: "vnd.vocdoni.avatar",

    // Language-dependent text fields
    NAME_PREFIX: "vnd.vocdoni.name.",
    DESCRIPTION_PREFIX: "vnd.vocdoni.description.",
    NEWS_FEED_URI_PREFIX: "vnd.vocdoni.news-feed.",
}

/**
 * ENS keys used to store the Text List Records on the Smart Contract
 */
export const TextListRecordKeys = {
    GATEWAY_BOOT_NODES: "vnd.vocdoni.gateway-boot-nodes",
    BOOT_ENTITIES: "vnd.vocdoni.boot-entities",
    FALLBACK_BOOTNODE_ENTITIES: "vnd.vocdoni.fallback-bootnodes-entities",
    TRUSTED_ENTITIES: "vnd.vocdoni.trusted-entities",
    CENSUS_SERVICES: "vnd.vocdoni.census-services",
    CENSUS_SERVICE_SOURCE_ENTITIES: "vnd.vocdoni.census-service-source-entities",
    CENSUS_IDS: "vnd.vocdoni.census-ids",
    CENSUS_MANAGER_KEYS: "vnd.vocdoni.census-manager-keys",
    RELAYS: "vnd.vocdoni.relays",
}

/**
 * JS object mimicking the ENS Text Records stored on the blockchain
 */
export type EntityResolverFields = {
    "vnd.vocdoni.languages": string[]
    "vnd.vocdoni.meta": string
    "vnd.vocdoni.voting-contract": string
    "vnd.vocdoni.gateway-update": { timeout: number, difficulty: number, topic: string }
    "vnd.vocdoni.process-ids.active": string[]
    "vnd.vocdoni.process-ids.ended": string[]
    "vnd.vocdoni.avatar": string

    // Language-dependent text fields
    "vnd.vocdoni.name.default": string    // FIXME: Use language codes in the future
    "vnd.vocdoni.description.default": string    // FIXME: Use language codes in the future
    "vnd.vocdoni.news-feed.default": string    // FIXME: Use language codes in the future

    // STRING ARRAYS
    "vnd.vocdoni.boot-entities": EntityReference[]
    "vnd.vocdoni.census-ids": HexString
    "vnd.vocdoni.census-manager-keys": EntityReference[]
    "vnd.vocdoni.census-services": MessagingURI
    "vnd.vocdoni.census-service-source-entities": EntityReference[]
    "vnd.vocdoni.fallback-bootnodes-entities": EntityReference[]
    "vnd.vocdoni.gateway-boot-nodes": GatewayBootNode[]
    "vnd.vocdoni.relays": RelayData[]
    "vnd.vocdoni.trusted-entities": EntityReference[]
}

/**
 * JSON metadata. Intended to be stored on IPFS or similar.
 * More info: http://vocdoni.io/docs/#/architecture/components/entity?id=meta
 */
export interface EntityMetadata {
    version: ProtocolVersion,             // Protocol version
    languages: ["default"], // FIXME: Remove in favor of actual language codes
    // languages: string[],                  // Two character language code (en, fr, it, ...)
    "voting-contract": ContractAddress,
    "gateway-update": {
        timeout: number,                  // milliseconds after which a Gateway is marked as down
        topic: string,                    // Topic used for the messaging protocol (e.g. "vocdoni-gateway-update")
        difficulty: number                // Difficulty of the proof of work, to prevent spammers
    },
    "process-ids": {
        active: ProcessId[],
        ended: ProcessId[]
    },
    avatar: ContentURI,

    // Language-dependent ENS fields
    name: MultiLanguage<string>,
    description: MultiLanguage<string>,
    "news-feed": MultiLanguage<ContentURI>,

    // Bootnodes providing a list of active Gateways
    "gateway-boot-nodes": GatewayBootNode[],

    // List of currently active Relays. This list is just for informational purposes.
    // The effective list of relays for a voting process is on the Voting Process smart contract
    relays: RelayData[],

    // List of custom interactions that the entity defines.
    // It may include anything like visiting web sites, uploading pictures, making payments, etc.
    actions: EntityCustomAction[]
}

interface GatewayBootNode {
    update: MessagingURI,         // Where Gateways should report their status updates
    fetch: URL                    // Where to fetch the Bootnode Gateways
}

interface RelayData {
    publicKey: PublicKey,  // Key to encrypt data sent to it
    messagingUri: MessagingURI    // Where to send messages. See Data origins > Messaging URI
}

export type EntityCustomAction = EntityBaseAction & (EntityBrowserAction | EntityImageUploadAction)

// The common fields of any action
interface EntityBaseAction {
    // Localized Call To Action to appear on the app
    name: MultiLanguage<string>,
}

// Opening an interactive web browser
interface EntityBrowserAction {
    type: "browser",

    // The URL to open
    // - The embedded web site can send messages to the host app
    // - Messages can request the public key, or a signature
    url: URL,

    // Endpoint to POST to with the publicKey and a signed timestamp
    // Returning true will show the action and hide it otherwise
    // Entering "true" instead of a URL will show it always
    visible: URL | true
}

// App-driven image upload example
interface EntityImageUploadAction {
    type: "image",

    // Requested image types to provide
    source: ImageUploadSource[],

    // Endpoint accepting POST requests with JSON payloads like:
    // {
    //   "field-name-1": "base64-image-payload",
    //   "another-field": "base64-image-payload",
    //   ...
    // }
    //
    // The URL will receive the following query string parameters:
    // - signature = sign(hash(jsonBody), privateKey)
    // - publicKey
    url: URL,

    // Endpoint to POST to with publicKey and signature+timestamp fields
    // Returning true will show the action and hide it otherwise
    visible: URL | true
}

type ImageUploadSource = {
    type: "front-camera" | "back-camera" | "gallery",
    name: string,                            // Arbitrary name to identify the data when the JSON is posted
    orientation?: "portrait" | "landscape",  // Optional when type == "gallery"
    overlay?: "face" | "id-card-front",
    caption?: MultiLanguage<string>
}

type EntityReference = {
    resolverAddress: HexString,
    entityId: HexString
}

///////////////////////////////////////////////////////////////////////////////
// VOTING PROCESS METADATA
///////////////////////////////////////////////////////////////////////////////

/**
 * More info: http://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json
 */
export interface VotingProcessMetadata {

}
