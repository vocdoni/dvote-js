// API names
export type GatewayApiName = "file" | "vote" | "census" | "results"
export type BackendApiName = "registry" | "oracle"
export type ApiName = GatewayApiName | BackendApiName | "info" | "raw"

// API method enum's
export const infoApiMethods = ["getInfo", "getStats", "getBlockList"] as const
export const rawApiMethods = ["submitRawTx"] as const
export const fileApiMethods = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"] as const
export const voteApiMethods = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessKeys", "getProcessList", "getEnvelopeList", "getBlockHeight", "getBlockStatus", "getProcessInfo", "getProcessSummary"] as const
export const censusApiMethods = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "genProof", "getSize", "checkProof", "dump", "dumpPlain", "importDump", "publish", "importRemote", "getCensusList"] as const
export const resultsApiMethods = ["getResults", "getResultsWeight", "getEntityList"] as const

export const registryApiMethods = ["signUp", "getEntity", "updateEntity", "countMembers", "listMembers", "getMember", "updateMember", "deleteMembers", "generateTokens", "exportTokens", "importMembers", "countTargets", "listTargets", "getTarget", "dumpTarget", "dumpCensus", "addCensus", "updateCensus", "getCensus", "countCensus", "listCensus", "deleteCensus", "sendValidationLinks", "sendVotingLinks", "createTag", "listTags", "deleteTag", "addTag", "removeTag"] as const
export const oracleApiMethods = ["newERC20process"] as const

export const gatewayApiMethods: GatewayApiMethod[] = [].concat(infoApiMethods).concat(rawApiMethods).concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods).concat(resultsApiMethods)
export const backendApiMethods: RegistryApiMethod[] = [].concat(registryApiMethods)

// API method families
export type InfoApiMethod = typeof infoApiMethods[number]
export type RawApiMethod = typeof rawApiMethods[number]
export type FileApiMethod = typeof fileApiMethods[number]
export type VoteApiMethod = typeof voteApiMethods[number]
export type CensusApiMethod = typeof censusApiMethods[number]
export type ResultsApiMethod = typeof resultsApiMethods[number]

export type RegistryApiMethod = typeof registryApiMethods[number]
export type OracleApiMethod = typeof oracleApiMethods[number]

export type GatewayApiMethod = RawApiMethod | FileApiMethod | VoteApiMethod | CensusApiMethod | ResultsApiMethod
export type BackendApiMethod = RegistryApiMethod | OracleApiMethod
export type ApiMethod = GatewayApiMethod | BackendApiMethod | InfoApiMethod

// API methods per family
export const allApis = {
    // Gateway
    file: fileApiMethods,
    vote: voteApiMethods,
    census: censusApiMethods,
    results: resultsApiMethods,

    // Backend
    registry: registryApiMethods,
    oracle: oracleApiMethods,

    // Other
    info: infoApiMethods,
    raw: rawApiMethods,
}

export type JsonBootnodeData = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: (GatewayApiName | BackendApiName)[], pubKey: string }[]
    }
}
