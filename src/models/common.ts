export type HexString = string
export type ContractAddress = HexString     // e.g. 0x1234567890123456789012345678901234567890
export type PublicKey = HexString           // Uncompressed ECDSA public key
export type PrivateKey = HexString
export type ProcessId = HexString           // Hash of the organizer's address and the nonce of the process

export type MultiLanguage<T> = {
    default: T
    // FIXME: Use language codes in the future
    // [lang: string]: T                // Indexed by language  { en: value, fr: value, ... }
}

/**
 * Comma-separated list of URI's. 
 * See http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=content-uri
 */
export type ContentURI = string

/**
 * Comma-separated list of URI's. 
 * See http://vocdoni.io/docs/#/architecture/protocol/data-origins?id=messaging-uri
 */
export type MessagingURI = string

export type URI = string
