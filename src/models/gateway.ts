export type DVoteSupportedApi = "file" | "vote" | "census"

export type FileApiMethod = "fetchFile" | "addFile" | "pinList" | "pinFile" | "unpinFile"
export type VoteApiMethod = "submitEnvelope" | "getEnvelopeStatus" | "getEnvelope" | "getEnvelopeHeight" | "getProcessList" | "getEnvelopeList"
export type CensusApiMethod = "addCensus" | "addClaim" | "addClaimBulk" | "getRoot" | "generateProof" | "checkProof" | "dump" | "dumpPlain" | "importDump"
export type WsGatewayMethod = FileApiMethod | VoteApiMethod | CensusApiMethod

export const fileApiMethods: FileApiMethod[] = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"]
export const voteApiMethods: VoteApiMethod[] = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessList", "getEnvelopeList"]
export const censusApiMethods: CensusApiMethod[] = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "generateProof", "checkProof", "dump", "dumpPlain", "importDump"]
export const dvoteGatewayApiMethods: (FileApiMethod | VoteApiMethod | CensusApiMethod)[] = [].concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods)

export type GatewayBootNodes = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: DVoteSupportedApi[], pubKey: string }[]
    }
}
