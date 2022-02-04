export type VocdoniEnvironment = "prod" | "stg" | "dev"
export type EthNetworkID = "homestead" | "mainnet" | "rinkeby" | "goerli" |
    "xdai" | "sokol" | "avalanche" | "fuji" | "matic" // | "mumbai"

export type HexString = string
export type ContractAddress = HexString     // e.g. 0x1234567890123456789012345678901234567890

export type MultiLanguage<T> = {
    default: T
    [lang: string]: T                // Indexed by language  { en: value, fr: value, ... }
}

export type URI = string

export type ContentUriString = string
