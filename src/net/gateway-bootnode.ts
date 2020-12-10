// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import ContentURI from "../wrappers/content-uri"
import { fetchFileString } from "../api/file"
import {
    vocdoniMainnetEntityId, vocdoniGoerliEntityId, vocdoniXDaiEntityId, vocdoniSokolEntityId, XDAI_ENS_REGISTRY_ADDRESS, XDAI_PROVIDER_URI, XDAI_CHAIN_ID,
    SOKOL_CHAIN_ID, SOKOL_PROVIDER_URI, SOKOL_ENS_REGISTRY_ADDRESS, XDAI_TEST_ENS_REGISTRY_ADDRESS, vocdoniXDaiTestEntityId
} from "../constants"
import { TextRecordKeys } from "../models/entity"
import { JsonBootnodeData } from "../models/gateway"
// import { Gateway } from "./gateway"
import { DVoteGateway, IDVoteGateway } from "./gateway-dvote"
import { IWeb3Gateway, Web3Gateway } from "./gateway-web3"
import { getDefaultProvider, providers } from "ethers"

export type EthNetworkID = "mainnet" | "goerli" | "xdai" | "sokol"


export class GatewayBootnode {
    /**
     * Retrieve the list of gateways provided by default by Vocdoni in the network
     * @param networkId The Ethereum network to which the gateways should be associated
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    static getDefaultGateways(networkId: EthNetworkID, options: { testing: boolean } = { testing: false }): Promise<JsonBootnodeData> {
        return GatewayBootnode.getDefaultUri(networkId, options)
            .then(contentUri => fetchFileString(contentUri))
            .then(strResult => JSON.parse(strResult))
            .catch(err => {
                throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
            })
    }

    /**
     * Retrieve the Content URI of the boot nodes Content URI provided by Vocdoni
     * @param networkId Either "mainnet" or "goerli" (test)
     * @returns A ContentURI object
     */
    static getDefaultUri(networkId: EthNetworkID, options: { testing: boolean } = { testing: false }): Promise<ContentURI> {
        let provider: providers.BaseProvider

        switch (networkId) {
            case "mainnet":
            case "goerli":
                provider = getDefaultProvider(networkId)
                break
            case "xdai":
                if (options.testing) {
                    provider = new providers.JsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_TEST_ENS_REGISTRY_ADDRESS })
                } else {
                    provider = new providers.JsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
                }
                break
            case "sokol":
                provider = new providers.JsonRpcProvider(SOKOL_PROVIDER_URI, { chainId: SOKOL_CHAIN_ID, name: "sokol", ensAddress: SOKOL_ENS_REGISTRY_ADDRESS });
                break
            default: throw new Error("Invalid Network ID")
        }

        const gw = new Web3Gateway(provider)
        return gw.getEnsPublicResolverInstance().then(instance => {
            let entityId: string
            switch (networkId) {
                case "mainnet":
                    entityId = vocdoniMainnetEntityId
                    break
                case "goerli":
                    entityId = vocdoniGoerliEntityId
                    break
                case "xdai":
                    entityId = options.testing ? vocdoniXDaiTestEntityId : vocdoniXDaiEntityId
                    break
                case "sokol":
                    entityId = vocdoniSokolEntityId
                    break
            }
            return instance.text(entityId, TextRecordKeys.VOCDONI_BOOT_NODES)
        }).then(uri => {
            if (!uri) throw new Error("The boot nodes Content URI is not defined on " + networkId)
            else return new ContentURI(uri)
        })
    }

    /**
     * Retrieve the list of gateways based on a Bootnode Content URI
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    static getGatewaysFromUri(bootnodesContentUri: string | ContentURI): Promise<JsonBootnodeData> {
        if (!bootnodesContentUri) return Promise.reject(new Error("Invalid bootNodeUri"))

        return fetchFileString(bootnodesContentUri)
            .then(strResult => JSON.parse(strResult))
            .catch(err => {
                throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
            })
    }

    // DIGEST

    /**
     * Transform the data received from a bootnode and return gateway instances for each network.
     * @param bootnodeData A JsonBootnodeData objects that represents the ata derrived from a Bootnode Content URI.
     * @returns An object with a list of IDVoteGateway(s) and IWeb3Gateway(s)
     */
    static digest(bootnodeData: JsonBootnodeData, options: { testing: boolean } = { testing: false }): { [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } } {
        const result: { [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } } = {}
        Object.keys(bootnodeData).forEach(networkId => {
            result[networkId] = GatewayBootnode.digestNetwork(bootnodeData, networkId, options)
        })
        return result
    }

    /**
     * Transform the data received from a bootnode and return the gateway instances for the given network.
     * @param bootnodeData A JsonBootnodeData objects that represents the ata derrived from a Bootnode Content URI.
     * @returns An object with a list of IDVoteGateway(s) and IWeb3Gateway(s)
     */
    static digestNetwork(bootnodeData: JsonBootnodeData, networkId: string, options: { testing: boolean } = { testing: false }): { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } {
        return {
            dvote: (bootnodeData[networkId].dvote || []).map(item => {
                return new DVoteGateway({ uri: item.uri, supportedApis: item.apis, publicKey: item.pubKey })
            }),
            web3: (bootnodeData[networkId].web3 || []).map(item => {
                return new Web3Gateway(item.uri, networkId as EthNetworkID, options)
            })
        }
    }
}
