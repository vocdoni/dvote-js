type ProtocolVersion = "1.0"
type HexString = string
type ContractAddress = HexString     // e.g. 0x1234567890123456789012345678901234567890
type PublicKey = HexString           // Uncompressed ECDSA public key
type PrivateKey = HexString
type ProcessId = HexString           // Hash of the organizer's address and the nonce of the process

type MultiLanguageText = {
    [lang: string]: string           // Indexed by language  { en: "Hello", fr: "Salut", ... }
}

type ContentURI = string             // Comma-separated list of URI's (http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=content-uri)
type MessagingURI = string           // Comma-separated list of URI's (http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=messaging-uri)
type URL = string

///////////////////////////////////////////////////////////////////////////////
// ENTITY METADATA
///////////////////////////////////////////////////////////////////////////////

// More info: http://vocdoni.io/docs/#/architecture/components/entity?id=meta

export interface EntityMetadata {
    version: ProtocolVersion,             // Protocol version
    languages: string[],                  // Two character language code (en, fr, it, ...)
    "entity-name": string,
    "entity-description": MultiLanguageText,
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
    "news-feed": {
        [lang: string]: ContentURI   // Indexed by language  { en: <content-uri>, fr: <content-uri>, ... }
    },
    avatar: ContentURI,

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

type EntityCustomAction = EntityBaseAction & (EntityBrowserAction | EntityImageUploadAction)

// The common fields of any action
interface EntityBaseAction {
    // Localized Call To Action to appear on the app
    name: MultiLanguageText,
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
    caption?: MultiLanguageText
}

type EntityReference = {
    resolverAddress: HexString,
    entityId: HexString
}

export type EntityResolverFields = {
    "vnd.vocdoni.languages": string[]
    "vnd.vocdoni.entity-name": string
    "vnd.vocdoni.meta": string
    "vnd.vocdoni.voting-contract": string
    "vnd.vocdoni.gateway-update": { timeout: number, difficulty: number, topic: string }
    "vnd.vocdoni.process-ids.active": string[]
    "vnd.vocdoni.process-ids.ended": string[]
    "vnd.vocdoni.avatar": string

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

///////////////////////////////////////////////////////////////////////////////
// VOTING PROCESS METADATA
///////////////////////////////////////////////////////////////////////////////

// More info: http://vocdoni.io/docs/#/architecture/components/process?id=process-metadata-json

export interface VotingProcessMetadata {

}
