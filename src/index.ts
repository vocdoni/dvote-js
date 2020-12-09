// API
import * as File from "./api/file"
import * as Entity from "./api/entity"
import * as Vote from "./api/voting"
import * as Census from "./api/census"
import * as Namespace from "./api/namespace"

// NETWORK
import * as Gateways from "./net/gateway"
export * from "./net/gateway-bootnode"
import * as Discovery from "./net/gateway-discovery"
import * as Pool from "./net/gateway-pool"
import * as Contracts from "./net/contracts"

// WRAPPERS
export { default as ContentURI } from "./wrappers/content-uri"
export { default as ContentHashedURI } from "./wrappers/content-hashed-uri"
export { default as GatewayInfo } from "./wrappers/gateway-info"

// UTIL
export * from "./util/providers"
export * from "./util/signers"
export * from "./util/random"
export * from "./util/data-signing"
export * from "./util/waiters"

// MODELS
import * as EntityModel from "./models/entity"
import * as ProcessModel from "./models/process"
import * as JsonFeedModel from "./models/json-feed"
import * as GatewayModel from "./models/gateway"


// EXPORTS
export const API = { File, Entity, Vote, Census }
export const Models = { Entity: EntityModel, Process: ProcessModel, Gateway: GatewayModel, JsonFeed: JsonFeedModel }
export const Network = { Gateways, Contracts, Discovery, Pool }

// // SOLIDITY HELPERS
// export { ProcessMode, ProcessEnvelopeType, ProcessStatus } from "dvote-solidity"
// export { IMethodOverrides } from "dvote-solidity"

// EXPORT TYPES
export * from "./types"
