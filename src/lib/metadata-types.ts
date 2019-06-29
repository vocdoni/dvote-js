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

/**
 * Comma-separated list of URI's. 
 * See http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=content-uri
 */
type ContentURI = string

/**
 * Comma-separated list of URI's. 
 * See http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=messaging-uri
 */
type MessagingURI = string

type URL = string

///////////////////////////////////////////////////////////////////////////////
// ENTITY METADATA
///////////////////////////////////////////////////////////////////////////////

/**
 * ENS keys used to store the Text Records on the Smart Contract
 */
export const TextRecordKeys = {
    JSON_METADATA_CONTENT_URI: "vnd.vocdoni.meta",
    VOTING_CONTRACT_ADDRESS: "vnd.vocdoni.voting-contract",
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
 * More info: http://vocdoni.io/docs/#/architecture/components/entity?id=meta
 */
export interface EntityMetadata {
    version: ProtocolVersion,                // Protocol version
    languages: ["default"], // FIXME: Remove in favor of actual language codes
    // languages: string[],                  // Two character language code (en, fr, it, ...)

    name: MultiLanguage<string>,
    description: MultiLanguage<string>,

    newsFeed: MultiLanguage<ContentURI>,
    votingContract: ContractAddress,
    votingProcesses: {
        active: ProcessId[],  // Process ID's to query on the Voting Contract
        ended: ProcessId[]
    },
    avatar: ContentURI,

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
    // List of currently active Relays. This list is just for informational purposes.
    // The effective list of relays for a voting process is on the Voting Process smart contract
    relays: RelayInfo[],

    bootEntities: EntityReference[],
    fallbackBootNodeEntities: EntityReference[],
    trustedEntities: EntityReference[],
    censusServiceManagedEntities: EntityReference[],
}

interface GatewayBootNode {
    heartbeatMessagingUri: MessagingURI,   // Where Gateways should report their status updates
    fetchUri: URL                          // Where to fetch the Bootnode Gateways
}

interface RelayInfo {
    publicKey: PublicKey,         // Uncompressed public key to encrypt data sent to it
    messagingUri: MessagingURI    // Where to send messages. See Data origins > Messaging URI
}

export type EntityCustomAction = EntityBaseAction & (EntityBrowserAction | EntityImageUploadAction)

// The common fields of any action
interface EntityBaseAction {
    // Localized Call To Action to appear on the app
    name: MultiLanguage<string>,

    // Endpoint to POST to with the publicKey and a signed timestamp
    // Returning true will show the action and hide it otherwise
    // Entering "true" instead of a URL will show it always
    visible: URL | true
}

// Opening an interactive web browser
interface EntityBrowserAction {
    type: "browser",

    // The URL to navigate to
    // - The embedded web site can send messages to the host app
    // - Messages can request the public key, or a signature
    url: URL
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
    // The URL will receive the following query string parameters:
    // - signature = sign(hash(jsonBody), privateKey)
    // - publicKey
    url: URL
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
