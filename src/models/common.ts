export type HexString = string
export type ContractAddress = HexString     // e.g. 0x1234567890123456789012345678901234567890
export type PublicKey = HexString           // Compressed ECDSA public key
export type PrivateKey = HexString
export type EntityId = HexString
export type ProcessId = HexString

export type MultiLanguage<T> = {
    default: T
    // FIXME: Use language codes in the future
    [lang: string]: T                // Indexed by language  { en: value, fr: value, ... }
}

export type URI = string

export type ContentUriString = string
export type ContentHashedUriString = string
export type MessagingUriString = string
