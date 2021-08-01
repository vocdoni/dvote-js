// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { ContentUri } from "../wrappers/content-uri"
import { FileApi } from "../api/file"
import {
    VOCDONI_MAINNET_ENTITY_ID, VOCDONI_RINKEBY_ENTITY_ID, VOCDONI_GOERLI_ENTITY_ID, VOCDONI_XDAI_ENTITY_ID, VOCDONI_SOKOL_ENTITY_ID, XDAI_ENS_REGISTRY_ADDRESS, XDAI_PROVIDER_URI, XDAI_CHAIN_ID,
    SOKOL_CHAIN_ID, SOKOL_PROVIDER_URI, SOKOL_ENS_REGISTRY_ADDRESS, XDAI_STG_ENS_REGISTRY_ADDRESS, VOCDONI_XDAI_STG_ENTITY_ID
} from "../constants"
import { TextRecordKeys } from "../models/entity"
import { JsonBootnodeData } from "../models/gateway"
// import { Gateway } from "./gateway"
import { DVoteGateway } from "./gateway-dvote"
import { Web3Gateway } from "./gateway-web3"
import { getDefaultProvider, providers } from "ethers"
import { EthNetworkID, VocdoniEnvironment } from "../common"
import { keccak256 } from "@ethersproject/keccak256"


export class GatewayBootnode {
    /**
     * Retrieve the list of gateways provided by default by Vocdoni in the network
     * @param networkId The Ethereum network to which the gateways should be associated
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    static getDefaultGateways(networkId: EthNetworkID = "xdai", environment: VocdoniEnvironment = "prod"): Promise<JsonBootnodeData> {
        return GatewayBootnode.getDefaultUri(networkId, environment)
            .then(contentUri => FileApi.fetchString(contentUri))
            .then(strResult => JSON.parse(strResult))
            .catch(err => {
                throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
            })
    }

    /**
     * Retrieve the Content URI of the boot nodes Content URI provided by Vocdoni
     * @param networkId Either "mainnet", "rinkeby" or "goerli" (test)
     * @returns A ContentURI object
     */
    static getDefaultUri(networkId: EthNetworkID = "xdai", environment: VocdoniEnvironment = "prod"): Promise<ContentUri> {
        let provider: providers.BaseProvider

        switch (networkId) {
            case "mainnet":
            case "goerli":
            case "rinkeby":
                provider = getDefaultProvider(networkId)
                break
            case "xdai":
                if (environment === "prod") {
                    provider = new providers.StaticJsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
                    break
                }
                provider = new providers.StaticJsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_STG_ENS_REGISTRY_ADDRESS })
                break
            case "sokol":
                provider = new providers.StaticJsonRpcProvider(SOKOL_PROVIDER_URI, { chainId: SOKOL_CHAIN_ID, name: "sokol", ensAddress: SOKOL_ENS_REGISTRY_ADDRESS });
                break
            default: throw new Error("Invalid Network ID")
        }

        const gw = new Web3Gateway(provider, networkId, environment)
        return gw.getEnsPublicResolverInstance().then(instance => {
            let entityEnsNode: string
            switch (networkId) {
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
                    if (environment === 'prod') {
                        entityEnsNode = keccak256(VOCDONI_XDAI_ENTITY_ID)
                        break
                    }
                    entityEnsNode = keccak256(VOCDONI_XDAI_STG_ENTITY_ID)
                    break
                case "sokol":
                    entityEnsNode = keccak256(VOCDONI_SOKOL_ENTITY_ID)
                    break
            }
            return instance.text(entityEnsNode, TextRecordKeys.VOCDONI_BOOT_NODES)
        }).then(uri => {
            if (!uri) throw new Error("The boot nodes Content URI is not defined on " + networkId)
            else return new ContentUri(uri)
        })
    }

    /**
     * Retrieve the list of gateways based on a Bootnode Content URI
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    static getGatewaysFromUri(bootnodesContentUri: string | ContentUri): Promise<JsonBootnodeData> {
        if (!bootnodesContentUri) return Promise.reject(new Error("Invalid bootNodeUri"))

        return FileApi.fetchString(bootnodesContentUri)
            .then(strResult => JSON.parse(strResult))
            .catch(err => {
                throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
            })
    }

    // DIGEST

    /**
     * Transform the data received from a bootnode and return gateway instances for each network.
     * @param bootnodeData A JsonBootnodeData objects that represents the ata derrived from a Bootnode Content URI.
     * @returns An object with a list of DVoteGateway(s) and Web3Gateway(s)
     */
    static digest(bootnodeData: JsonBootnodeData, environment: VocdoniEnvironment = "prod"): { [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } } {
        const result: { [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } } = {}
        Object.keys(bootnodeData).forEach(networkId => {
            result[networkId] = GatewayBootnode.digestNetwork(bootnodeData, networkId, environment)
        })
        return result
    }

    /**
     * Transform the data received from a bootnode and return the gateway instances for the given network.
     * @param bootnodeData A JsonBootnodeData objects that represents the ata derrived from a Bootnode Content URI.
     * @returns An object with a list of DVoteGateway(s) and Web3Gateway(s)
     */
    static digestNetwork(bootnodeData: JsonBootnodeData, networkId: string, environment: VocdoniEnvironment = "prod"): { dvote: DVoteGateway[], web3: Web3Gateway[] } {
        if (!bootnodeData || typeof bootnodeData[networkId] != "object") return { dvote: [], web3: [] }

        return {
            dvote: (bootnodeData[networkId].dvote || []).map(item => {
                return new DVoteGateway({ uri: item.uri, supportedApis: item.apis, publicKey: item.pubKey })
            }),
            web3: (bootnodeData[networkId].web3 || []).map(item => {
                return new Web3Gateway(item.uri, networkId as EthNetworkID, environment)
            })
        }
    }
}
