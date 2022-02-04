import { keccak256 } from "@ethersproject/keccak256"
import {
    EthNetworkID,
    VOCDONI_GOERLI_ENTITY_ID,
    VOCDONI_MAINNET_ENTITY_ID,
    VOCDONI_RINKEBY_ENTITY_ID,
    VOCDONI_SOKOL_ENTITY_ID,
    VOCDONI_XDAI_ENTITY_ID,
    VOCDONI_XDAI_STG_ENTITY_ID,
    VocdoniEnvironment,
    VOCDONI_AVAX_FUJI_ENTITY_ID,
    VOCDONI_MATIC_ENTITY_ID,
    VOCDONI_MUMBAI_ENTITY_ID
} from "@vocdoni/common"
import { IEnsPublicResolverContract } from "@vocdoni/contract-wrappers"
import { IGatewayWeb3Client } from "../interfaces"

export function getEnsTextRecord(
    gateway: IGatewayWeb3Client,
    recordKey: string,
    params: { environment: VocdoniEnvironment, networkId: EthNetworkID } = { environment: "prod", networkId: "mainnet" },
): Promise<string> {
    return gateway.getEnsPublicResolverInstance()
        .then(async (instance: IEnsPublicResolverContract) => {
            let entityEnsNode = ""
            switch (params.networkId) {
                case "homestead":
                case "mainnet":
                    entityEnsNode = keccak256(VOCDONI_MAINNET_ENTITY_ID)
                    break
                case "goerli":
                    entityEnsNode = keccak256(VOCDONI_GOERLI_ENTITY_ID)
                    break
                case "rinkeby":
                    entityEnsNode = keccak256(VOCDONI_RINKEBY_ENTITY_ID)
                    break
                case "xdai":
                    if (params.environment === "prod") {
                        entityEnsNode = keccak256(VOCDONI_XDAI_ENTITY_ID)
                        break
                    }
                    entityEnsNode = keccak256(VOCDONI_XDAI_STG_ENTITY_ID)
                    break
                case "sokol":
                    entityEnsNode = keccak256(VOCDONI_SOKOL_ENTITY_ID)
                    break
                case "fuji":
                    entityEnsNode = keccak256(VOCDONI_AVAX_FUJI_ENTITY_ID)
                    break
                case "matic":
                    entityEnsNode = keccak256(VOCDONI_MATIC_ENTITY_ID)
                    break
                case "mumbai":
                    entityEnsNode = keccak256(VOCDONI_MUMBAI_ENTITY_ID)
                    break
                default:
                    throw new Error("Unsupported network ID")
            }
            return instance.text(entityEnsNode, recordKey)
        })
}
