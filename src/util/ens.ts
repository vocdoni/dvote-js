import {keccak256} from "@ethersproject/keccak256"
import {
    VOCDONI_GOERLI_ENTITY_ID,
    VOCDONI_MAINNET_ENTITY_ID,
    VOCDONI_RINKEBY_ENTITY_ID, VOCDONI_SOKOL_ENTITY_ID,
    VOCDONI_XDAI_ENTITY_ID, VOCDONI_XDAI_STG_ENTITY_ID
} from "../constants"
import {VocdoniEnvironment} from "../models/common";
import {IEnsPublicResolverContract} from "../net/contracts";
import {IGateway} from "../net/gateway"
import {EthNetworkID} from "../net/gateway-bootnode";
import {IGatewayPool} from "../net/gateway-pool"
import {IWeb3Gateway} from "../net/gateway-web3";

export function getEnsPublicResolverByNetwork(
    gateway: IGateway | IGatewayPool | IWeb3Gateway,
    params: { environment: VocdoniEnvironment, networkId: EthNetworkID } = { environment: "prod", networkId: "mainnet" },
): Promise<{ instance: IEnsPublicResolverContract, entityEnsNode: string }> {
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
            return { instance, entityEnsNode }
        })
}
