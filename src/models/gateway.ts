// API names
export type GatewayApiName = "file" | "vote" | "census" | "results"
export type BackendApiName = "registry"
export type ApiName = GatewayApiName | BackendApiName | "info"

const GET_INFO_METHOD_NAME = "getInfo"

// API method families
export type FileApiMethod = "fetchFile" | "addFile" | "pinList" | "pinFile" | "unpinFile"
export type VoteApiMethod = "submitEnvelope" | "getEnvelopeStatus" | "getEnvelope" | "getEnvelopeHeight" | "getProcessKeys" | "getProcessList" | "getEnvelopeList" | "getBlockHeight" | "getBlockStatus" | "getResults"
export type CensusApiMethod = "addCensus" | "addClaim" | "addClaimBulk" | "getRoot" | "genProof" | "getSize" | "checkProof" | "dump" | "dumpPlain" | "importDump" | "publish" | "importRemote"
export type ResultsApiMethod = "getProcListResults" | "getProcListLiveResults" | "getResults" | "getScrutinizerEntities"

export type RegistryApiMethod = "signUp" | "getEntity" | "updateEntity" | "countMembers" | "listMembers" | "getMember" | "updateMember" | "deleteMembers" | "generateTokens" | "exportTokens" | "importMembers" | "countTargets" | "listTargets" | "getTarget" | "dumpTarget" | "dumpCensus" | "addCensus" | "updateCensus" | "getCensus" | "countCensus" | "listCensus" | "deleteCensus" | "sendValidationLinks" | "sendVotingLinks" | "createTag" | "listTags" | "deleteTag" | "addTag" | "removeTag"

export type InfoApiMethod = typeof GET_INFO_METHOD_NAME

export type GatewayApiMethod = FileApiMethod | VoteApiMethod | CensusApiMethod | ResultsApiMethod
export type BackendApiMethod = RegistryApiMethod
export type ApiMethod = GatewayApiMethod | BackendApiMethod | InfoApiMethod

// API method enum's
export const fileApiMethods: FileApiMethod[] = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"]
export const voteApiMethods: VoteApiMethod[] = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessKeys", "getProcessList", "getEnvelopeList", "getBlockHeight", "getBlockStatus", "getResults"]
export const censusApiMethods: CensusApiMethod[] = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "genProof", "getSize", "checkProof", "dump", "dumpPlain", "importDump", "publish", "importRemote"]
export const resultsApiMethods: ResultsApiMethod[] = ["getProcListResults", "getProcListLiveResults", "getResults", "getScrutinizerEntities"]

export const registryApiMethods: RegistryApiMethod[] = ["signUp", "getEntity", "updateEntity", "countMembers", "listMembers", "getMember", "updateMember", "deleteMembers", "generateTokens", "exportTokens", "importMembers", "countTargets", "listTargets", "getTarget", "dumpTarget", "dumpCensus", "addCensus", "updateCensus", "getCensus", "countCensus", "listCensus", "deleteCensus", "sendValidationLinks", "sendVotingLinks", "createTag", "listTags", "deleteTag", "addTag", "removeTag"]

export const gatewayApiMethods: GatewayApiMethod[] = [].concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods).concat(resultsApiMethods)
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

    // Info
    info: [GET_INFO_METHOD_NAME],
}

export type JsonBootnodeData = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: (GatewayApiName | BackendApiName)[], pubKey: string }[]
    }
}
