// API names
export type GatewayApiName = "file" | "vote" | "census" | "results"
export type BackendApiName = "registry" | "oracle"
export type ApiName = GatewayApiName | BackendApiName | "info" | "raw"

const GET_INFO_METHOD_NAME = "getInfo"

// API method families
export type RawApiMethod = "submitRawTx"
export type FileApiMethod = "fetchFile" | "addFile" | "pinList" | "pinFile" | "unpinFile"
export type VoteApiMethod = "submitEnvelope" | "getEnvelopeStatus" | "getEnvelope" | "getEnvelopeHeight" | "getProcessKeys" | "getProcessList" | "getEnvelopeList" | "getBlockHeight" | "getBlockStatus" | "getProcessInfo" | "getProcessMeta"
export type CensusApiMethod = "addCensus" | "addClaim" | "addClaimBulk" | "getRoot" | "genProof" | "getSize" | "checkProof" | "dump" | "dumpPlain" | "importDump" | "publish" | "importRemote" | "getCensusList"
export type ResultsApiMethod = "getResults" | "getResultsWeight" | "getEntityList"

export type RegistryApiMethod = "signUp" | "getEntity" | "updateEntity" | "countMembers" | "listMembers" | "getMember" | "updateMember" | "deleteMembers" | "generateTokens" | "exportTokens" | "importMembers" | "countTargets" | "listTargets" | "getTarget" | "dumpTarget" | "dumpCensus" | "addCensus" | "updateCensus" | "getCensus" | "countCensus" | "listCensus" | "deleteCensus" | "sendValidationLinks" | "sendVotingLinks" | "createTag" | "listTags" | "deleteTag" | "addTag" | "removeTag"
export type OracleApiMethod = "newERC20process"

export type InfoApiMethod = typeof GET_INFO_METHOD_NAME

export type GatewayApiMethod = RawApiMethod | FileApiMethod | VoteApiMethod | CensusApiMethod | ResultsApiMethod
export type BackendApiMethod = RegistryApiMethod | OracleApiMethod
export type ApiMethod = GatewayApiMethod | BackendApiMethod | InfoApiMethod

// API method enum's
export const rawApiMethods: RawApiMethod[] = ["submitRawTx"]
export const fileApiMethods: FileApiMethod[] = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"]
export const voteApiMethods: VoteApiMethod[] = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessKeys", "getProcessList", "getEnvelopeList", "getBlockHeight", "getBlockStatus", "getProcessInfo"]
export const censusApiMethods: CensusApiMethod[] = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "genProof", "getSize", "checkProof", "dump", "dumpPlain", "importDump", "publish", "importRemote", "getCensusList"]
export const resultsApiMethods: ResultsApiMethod[] = ["getResults", "getResultsWeight", "getEntityList"]

export const registryApiMethods: RegistryApiMethod[] = ["signUp", "getEntity", "updateEntity", "countMembers", "listMembers", "getMember", "updateMember", "deleteMembers", "generateTokens", "exportTokens", "importMembers", "countTargets", "listTargets", "getTarget", "dumpTarget", "dumpCensus", "addCensus", "updateCensus", "getCensus", "countCensus", "listCensus", "deleteCensus", "sendValidationLinks", "sendVotingLinks", "createTag", "listTags", "deleteTag", "addTag", "removeTag"]
export const oracleApiMethods: OracleApiMethod[] = ["newERC20process"]

export const gatewayApiMethods: GatewayApiMethod[] = [].concat(rawApiMethods).concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods).concat(resultsApiMethods)
export const backendApiMethods: RegistryApiMethod[] = [].concat(registryApiMethods)

// API methods per family
export const allApis: { [k in ApiName]: ApiMethod[] } = {
    // Gateway
    file: fileApiMethods,
    vote: voteApiMethods,
    census: censusApiMethods,
    results: resultsApiMethods,

    // Backend
    registry: registryApiMethods,
    oracle: oracleApiMethods,

    // Other
    info: [GET_INFO_METHOD_NAME],
    raw: rawApiMethods,
}

export type JsonBootnodeData = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: (GatewayApiName | BackendApiName)[], pubKey: string }[]
    }
}
