export type DVoteSupportedApi = "file" | "vote" | "census"

export type FileApiMethod = "fetchFile" | "addFile" | "pinList" | "pinFile" | "unpinFile"
export type VoteApiMethod = "submitEnvelope" | "getEnvelopeStatus" | "getEnvelope" | "getEnvelopeHeight" | "getProcessList" | "getEnvelopeList" | "getBlockHeight"
export type CensusApiMethod = "addCensus" | "addClaim" | "addClaimBulk" | "getRoot" | "genProof" | "getSize" | "checkProof" | "dump" | "dumpPlain" | "importDump" | "publish" | "importRemote"
export type GatewayApiMethod = "getGatewayInfo"
export type WsGatewayMethod = FileApiMethod | VoteApiMethod | CensusApiMethod | GatewayApiMethod

export const fileApiMethods: FileApiMethod[] = ["fetchFile", "addFile", "pinList", "pinFile", "unpinFile"]
export const voteApiMethods: VoteApiMethod[] = ["submitEnvelope", "getEnvelopeStatus", "getEnvelope", "getEnvelopeHeight", "getProcessList", "getEnvelopeList", "getBlockHeight"]
export const censusApiMethods: CensusApiMethod[] = ["addCensus", "addClaim", "addClaimBulk", "getRoot", "genProof", "checkProof", "dump", "dumpPlain", "importDump", "publish", "importRemote"]
export const dvoteGatewayApiMethods: (FileApiMethod | VoteApiMethod | CensusApiMethod)[] = [].concat(fileApiMethods).concat(voteApiMethods).concat(censusApiMethods)

export type GatewayBootNodes = {
    [k: string]: {
        web3: { uri: string }[],
        dvote: { uri: string, apis: DVoteSupportedApi[], pubKey: string }[]
    }
}
