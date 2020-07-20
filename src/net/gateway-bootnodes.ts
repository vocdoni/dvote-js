// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import ContentURI from "../wrappers/content-uri"
import { fetchFileString } from "../api/file"
import { vocdoniMainnetEntityId, vocdoniGoerliEntityId, vocdoniXDaiEntityId, XDAI_ENS_REGISTRY_ADDRESS, XDAI_PROVIDER_URI, XDAI_CHAIN_ID } from "../constants"
import { getEntityResolverInstance } from "../net/contracts"
import { TextRecordKeys } from "../models/entity"
import { GatewayBootNodes } from "../models/gateway"
import { DVoteGateway, Web3Gateway, IDVoteGateway, IWeb3Gateway } from "./gateway"
import { getDefaultProvider, providers } from "ethers"

export type NetworkID = "mainnet" | "goerli" | "xdai"

/**
 * Retrieve the Content URI of the boot nodes Content URI provided by Vocdoni
 * @param networkId Either "mainnet" or "goerli" (test)
 * @returns A ContentURI object
 */
export function getDefaultBootnodeContentUri(networkId: NetworkID): Promise<ContentURI> {
    let provider: providers.BaseProvider

    switch (networkId) {
        case "mainnet":
        case "goerli":
            provider = getDefaultProvider(networkId)
            break
        case "xdai":
            provider = new providers.JsonRpcProvider(XDAI_PROVIDER_URI, { chainId: XDAI_CHAIN_ID, name: "xdai", ensAddress: XDAI_ENS_REGISTRY_ADDRESS })
            break
        default: throw new Error("Invalid Network ID")
    }

    return getEntityResolverInstance({ provider }).then(instance => {
        let entityId: string
        switch (networkId) {
            case "mainnet":
                entityId = vocdoniMainnetEntityId
                break
            case "goerli":
                entityId = vocdoniGoerliEntityId
                break
            case "xdai":
                entityId = vocdoniXDaiEntityId
                break
        }
        return instance.text(entityId, TextRecordKeys.VOCDONI_BOOT_NODES)
    }).then(uri => {
        if (!uri) throw new Error("The boot nodes Content URI is not defined on " + networkId)
        else return new ContentURI(uri)
    })
}

/**
 * Retrieve the list of gateways from the data derrived from a BootNode Content URI.
 * @param bootnodeData A GatewayBootNodes objects that represents the ata derrived from a BootNode Content URI.
 * @returns An object with a list of IDVoteGateway(s) and IWeb3Gateway(s)
 */
export function getGatewaysFromBootNodeData(bootnodeData: GatewayBootNodes): { [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } } {
    const result: { [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } } = {}
    Object.keys(bootnodeData).forEach(networkId => {
        result[networkId] = {
            dvote: (bootnodeData[networkId].dvote || []).map(item => {
                return new DVoteGateway({ uri: item.uri, supportedApis: item.apis, publicKey: item.pubKey })
            }),
            web3: (bootnodeData[networkId].web3 || []).map(item => {
                return new Web3Gateway(item.uri, networkId as NetworkID)
            })
        }
    })
    return result
}

/**
 * Retrieve the list of gateways provided by default by Vocdoni in the network
 * @param networkId The Ethereum network to which the gateways should be associated
 * @returns A GatewayBootnodes object that represents the ata derrived from a BootNode Content URI.
 */
export function fetchDefaultBootNode(networkId: NetworkID): Promise<GatewayBootNodes> {
    return getDefaultBootnodeContentUri(networkId)
        .then(contentUri => {
            return fetchFileString(contentUri)
        }).then(strResult => {
            const result = JSON.parse(strResult)
            return result
        })
        .catch(err => {
            throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
        })
}

/**
 * Retrieve the list of gateways based on a BootNode Content URI
 * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
 * @returns A GatewayBootnodes object that represents the ata derrived from a BootNode Content URI.
 */
export function fetchFromBootNode(bootnodesContentUri: string | ContentURI): Promise<GatewayBootNodes> {
    if (!bootnodesContentUri) return Promise.reject(new Error("Invalid bootNodeUri"))

    return fetchFileString(bootnodesContentUri).then(strResult => {
        const result = JSON.parse(strResult)
        return result
    }).catch(err => {
        throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
    })
}
