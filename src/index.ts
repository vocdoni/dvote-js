// API
import * as File from "./api/file"
import * as Entity from "./api/entity"
import * as Vote from "./api/vote"
import * as Census from "./api/census"

// NETWORK
import * as Gateway from "./net/gateway"
import * as Contract from "./net/contract"

// WRAPPERS
import { default as ContentURI } from "./util/content-uri"
import { default as ContentHashedURI } from "./util/content-hashed-uri"
import { default as GatewayInfo } from "./util/gateway-info"

// UTIL
import * as Providers from "./util/providers"
import * as Signers from "./util/signers"

// TYPES
import * as Common from "./models/common"
import * as EntityModel from "./models/entity"
import * as VotingProcessModel from "./models/voting-process"

// EXPORTS

export const API = { File, Entity, Vote, Census }
export const Network = { Gateway, Contract }
export const Wrappers = { ContentURI, ContentHashedURI, GatewayInfo }
export const EtherUtils = { Providers, Signers }
export const Types = { Common, EntityModel, VotingProcessModel }
