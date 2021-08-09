import { keccak256 } from "@ethersproject/keccak256"
import { EthNetworkID, IGatewayWeb3Client, VocdoniEnvironment } from "../common";
import {
    VOCDONI_GOERLI_ENTITY_ID,
    VOCDONI_MAINNET_ENTITY_ID,
    VOCDONI_RINKEBY_ENTITY_ID, VOCDONI_SOKOL_ENTITY_ID,
    VOCDONI_XDAI_ENTITY_ID, VOCDONI_XDAI_STG_ENTITY_ID
} from "../constants"

export function getEnsTextRecord(
    gateway: IGatewayWeb3Client,
    recordKey: string,
    params: { environment: VocdoniEnvironment, networkId: EthNetworkID } = { environment: "prod", networkId: "mainnet" },
): Promise<string> {
    return gateway.getEnsPublicResolverInstance()
        .then(async instance => {
            let entityEnsNode: string
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
            }
            return instance.text(entityEnsNode, recordKey)
        })
}
