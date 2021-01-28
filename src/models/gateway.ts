export type DVoteSupportedApi = "file" | "vote" | "census" | "results" | "info"

export type FileApiMethod = "fetchFile" | "addFile" | "pinList" | "pinFile" | "unpinFile"
export type VoteApiMethod = "submitEnvelope" | "getEnvelopeStatus" | "getEnvelope" | "getEnvelopeHeight" | "getProcessKeys" | "getProcessList" | "getEnvelopeList" | "getBlockHeight" | "getBlockStatus" | "getResults"
export type CensusApiMethod = "addCensus" | "addClaim" | "addClaimBulk" | "getRoot" | "genProof" | "getSize" | "checkProof" | "dump" | "dumpPlain" | "importDump" | "publish" | "importRemote"
export type ResultsApiMethod = "getProcListResults" | "getProcListLiveResults" | "getResults" | "getScrutinizerEntities"
export type InfoApiMethod = "getGatewayInfo"
export type DVoteGatewayMethod = FileApiMethod | VoteApiMethod | CensusApiMethod | ResultsApiMethod | InfoApiMethod
export type RegistryApiMethod = "signUp" | "getEntity" | "updateEntity" | "countMembers" | "listMembers" | "getMember" | "updateMember" | "deleteMembers" | "generateTokens" | "exportTokens" | "importMembers" | "countTargets" | "listTargets" | "getTarget" | "dumpTarget" | "dumpCensus" | "addCensus" | "updateCensus" | "getCensus" | "countCensus" | "listCensus" | "deleteCensus" | "sendValidationLinks" | "sendVotingLinks" | "createTag" | "listTags" | "deleteTag" | "addTag" | "removeTag"

export const fileApiMethods: FileApiMethod[] = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"]
export const voteApiMethods: VoteApiMethod[] = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessKeys", "getProcessList", "getEnvelopeList", "getBlockHeight", "getBlockStatus", "getResults"]
export const censusApiMethods: CensusApiMethod[] = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "genProof", "getSize", "checkProof", "dump", "dumpPlain", "importDump", "publish", "importRemote"]
export const resultsApiMethods: ResultsApiMethod[] = ["getProcListResults", "getProcListLiveResults", "getResults", "getScrutinizerEntities"]
export const infoApiMethods: InfoApiMethod[] = ["getGatewayInfo"]
export const dvoteGatewayApiMethods: (FileApiMethod | VoteApiMethod | CensusApiMethod | ResultsApiMethod | InfoApiMethod)[] = [].concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods).concat(resultsApiMethods).concat(infoApiMethods)
export const dvoteApis: { [k in DVoteSupportedApi]: DVoteGatewayMethod[] } = {
    "file": fileApiMethods,
    "vote": voteApiMethods,
    "census": censusApiMethods,
    "results": resultsApiMethods,
    "info": infoApiMethods,
}
export const registryApiMethods: RegistryApiMethod[] = ["signUp", "getEntity", "updateEntity", "countMembers", "listMembers", "getMember", "updateMember", "deleteMembers", "generateTokens", "exportTokens", "importMembers", "countTargets", "listTargets", "getTarget", "dumpTarget", "dumpCensus", "addCensus", "updateCensus", "getCensus", "countCensus", "listCensus", "deleteCensus", "sendValidationLinks", "sendVotingLinks", "createTag", "listTags", "deleteTag", "addTag", "removeTag"]

export type JsonBootnodeData = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: DVoteSupportedApi[], pubKey: string }[]
    }
}
