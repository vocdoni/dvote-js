// API
import * as File from "./api/file"
import * as Entity from "./api/entity"
import * as Vote from "./api/vote"
import * as Census from "./api/census"

// NETWORK
import * as Gateway from "./net/gateway"
import * as Bootnodes from "./net/gateway-bootnodes"
import * as Contracts from "./net/contracts"

// WRAPPERS
import { default as ContentURI } from "./wrappers/content-uri"
import { default as ContentHashedURI } from "./wrappers/content-hashed-uri"
import { default as GatewayInfo } from "./wrappers/gateway-info"

// UTIL
import * as Providers from "./util/providers"
import * as Signers from "./util/signers"
import * as JsonSign from "./util/json-sign"

// MODELS
import * as EntityModel from "./models/entity"
import * as VotingProcessModel from "./models/voting-process"
import * as JsonFeedModel from "./models/json-feed"
import * as GatewayModel from "./models/gateway"


// EXPORTS
export const API = { File, Entity, Vote, Census }
export const Models = { Entity: EntityModel, Vote: VotingProcessModel, Gateway: GatewayModel, JsonFeed: JsonFeedModel }
export const Network = { Bootnodes, Gateway, Contracts }
export const Wrappers = { ContentURI, ContentHashedURI, GatewayInfo }
export const EtherUtils = { Providers, Signers }
export { JsonSign }

// EXPORT TYPES
export * from "./types"
