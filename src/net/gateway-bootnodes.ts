// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import ContentURI from "../wrappers/content-uri"
import GatewayInfo from "../wrappers/gateway-info"
import { fetchFileString } from "../api/file"
import { vocdoniHomesteadEntityId, vocdoniGoerliEntityId } from "../constants"
import { getEntityResolverInstance } from "../net/contracts"
import { TextRecordKeys } from "../models/entity"
import { GatewayBootNodes } from "../models/gateway"
import { DVoteGateway, Web3Gateway, IDVoteGateway, IWeb3Gateway } from "./gateway"
import { getDefaultProvider, providers } from "ethers"
import { JsonRpcProvider } from "ethers/providers"

type NetworkID = "homestead" | "goerli"

/**
 * Retrieve the Content URI of the boot nodes Content URI provided by Vocdoni
 * @param networkId Either "homestead" (mainnet) or "goerli" (test)
 */
export function getDefaultBootnodeContentUri(networkId: NetworkID): Promise<ContentURI> {
    let provider: providers.BaseProvider

    switch (networkId) {
        case "homestead":
        case "goerli":
            provider = getDefaultProvider(networkId)
            break;
        default: throw new Error("Invalid Network ID")
    }

    return getEntityResolverInstance({ provider }).then(instance => {
        const entityId = networkId == "homestead" ? vocdoniHomesteadEntityId : vocdoniGoerliEntityId
        return instance.text(entityId, TextRecordKeys.VOCDONI_BOOT_NODES)
    }).then(uri => {
        if (!uri) throw new Error("The boot nodes Content URI is not defined on " + networkId)
        else return new ContentURI(uri)
    })
}

/**
 * Retrieve a list of gateways provided by default by Vocdoni.
 * The resulting set of `dvote[]` objects may need that you call `connect()` before you use them.
 */
export function getDefaultGateways(networkId: NetworkID): Promise<{ [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } }> {
    return getDefaultBootnodeContentUri(networkId)
        .then(contentUri => getGatewaysFromBootNode(contentUri))
}

/**
 * Retrieve the list of gateways for a given BootNode(s) Content URI.
 * The resulting set of `dvote[]` objects may need that you call `connect()` before you use them.
 */
export function getGatewaysFromBootNode(bootnodesContentUri: string | ContentURI): Promise<{ [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } }> {
    if (!bootnodesContentUri) throw new Error("Invalid Content URI")

    return fetchFromBootNode(bootnodesContentUri).then(data => {
        const result: { [networkId: string]: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } } = {}
        Object.keys(data).forEach(networkId => {
            result[networkId] = {
                dvote: (data[networkId].dvote || []).map(item => {
                    return new DVoteGateway({ uri: item.uri, supportedApis: item.apis, publicKey: item.pubKey })
                }),
                web3: (data[networkId].web3 || []).map(item => {
                    return new Web3Gateway(item.uri)
                })
            }
        })
        return result
    }).catch(err => {
        throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
    })
}

/**
 * Retrieve the parameters of a randomly chosen DVote and Web3 gateway.
 * If no parameter is provided, the default gateways provided by Vocdoni will be used as the source.
 * If a Content URI is provided, the choice will be made from its data.
 */
export async function getRandomGatewayInfo(networkId: NetworkID, bootnodesContentUri?: string | ContentURI): Promise<{ [networkId: string]: GatewayInfo }> {
    const result: { [networkId: string]: GatewayInfo } = {}

    const gws = bootnodesContentUri ? await fetchFromBootNode(bootnodesContentUri) : await fetchDefaultBootNode(networkId)

    for (let networkId in gws) {
        const dvLen = gws && gws[networkId] && gws[networkId].dvote
            && gws[networkId].dvote.length || 0
        if (!dvLen) throw new Error("Could not fetch the Entity metadata")
        const w3Len = gws && gws[networkId] && gws[networkId].web3
            && gws[networkId].web3.length || 0
        if (!w3Len) throw new Error("Could not fetch the Entity metadata")

        const dvGw = gws[networkId].dvote[Math.floor(Math.random() * dvLen)]
        const w3Gw = gws[networkId].web3[Math.floor(Math.random() * w3Len)]
        result[networkId] = new GatewayInfo(dvGw.uri, dvGw.apis, w3Gw.uri, dvGw.pubKey)
    }
    return result
}

/**
 * Retrieve the list of gateways provided by default by Vocdoni
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
 * Retrieve the list of gateways for a given BootNode(s) Content URI
 */
export function fetchFromBootNode(bootnodesContentUri: string | ContentURI): Promise<GatewayBootNodes> {
    if (!bootnodesContentUri) throw new Error("Invalid bootNodeUri")

    return fetchFileString(bootnodesContentUri).then(strResult => {
        const result = JSON.parse(strResult)
        return result
    }).catch(err => {
        throw new Error(err && err.message || "Unable to fetch the boot node(s) data")
    })
}

/**
 * Retrieve a list of curently active gateways for the given entityAddress
 */
export async function getActiveEntityGateways(entityAddress: string): Promise<GatewayInfo> {
    throw new Error("TODO: unimplemented") // TODO: getActiveEntityGateways()
}

/**
 * @param networkId The Ethereum network to which the gateway should be associated
 * @returns A GatewayInfo object
 */
export async function getWorkingGatewayInfo(networkId: NetworkID, bootnodesContentUri?: string | ContentURI ): Promise<GatewayInfo> {

    const defaultGateways = bootnodesContentUri ? await getGatewaysFromBootNode(bootnodesContentUri) : await getDefaultGateways(networkId)
    const dvoteNodes: DVoteGateway[] = defaultGateways[networkId].dvote
    const web3Nodes: Web3Gateway[] = defaultGateways[networkId].web3

    if (!dvoteNodes.length)
        Promise.reject(new Error(`The Dvote gateway list is empty of ${networkId}`))

    const web3Provider = web3Nodes[Math.floor(Math.random() * web3Nodes.length)].getProvider() as JsonRpcProvider
    const web3Url = web3Provider.connection.url

    let workingDvoteGateways: GatewayInfo[] = []
    let found = false

    return Promise.all(dvoteNodes
        .map((node) =>
            node.isUp()
                .then(async ({ result, dvoteUri, supportedApis, pubKey }) => {
                    await node.disconnect()
                    if (result) {
                        found = true
                        workingDvoteGateways.push(new GatewayInfo(dvoteUri, supportedApis, web3Url, pubKey))
                    }
                }).catch((err) => {
                    // console.error(err)
                })
        ))
        .then(() => {
            if (!found) {
                throw new Error("None of the gateways is available")
            }
            return workingDvoteGateways[0]
        })
}