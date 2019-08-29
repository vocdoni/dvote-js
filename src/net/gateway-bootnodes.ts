// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import ContentURI from "../wrappers/content-uri"
import GatewayInfo from "../wrappers/gateway-info"
import { fetchFileString } from "../api/file"
import { defaultBootnodeContentUri } from "../constants"
import { GatewayBootNodes } from "../models/gateway"
import { DVoteGateway, Web3Gateway } from "./gateway"

/**
 * Retrieve a list of gateways provided by default by Vocdoni.
 * The resulting set of `dvote[]` objects may need that you call `connect()` before you use them.
 */
export function getDefaultGateways(): Promise<{ [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } }> {
    return getGatewaysFromBootNode(defaultBootnodeContentUri)
}

/**
 * Retrieve the list of gateways for a given BootNode(s) Content URI.
 * The resulting set of `dvote[]` objects may need that you call `connect()` before you use them.
 */
export function getGatewaysFromBootNode(bootnodesContentUri: string | ContentURI): Promise<{ [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } }> {
    if (!bootnodesContentUri) throw new Error("Invalid Content URI")

    return fetchFromBootNode(bootnodesContentUri).then(data => {
        const result: { [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } } = {}
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
export async function getRandomGatewayInfo(bootnodesContentUri?: string | ContentURI): Promise<{ [networkId: string]: GatewayInfo }> {
    const result: { [networkId: string]: GatewayInfo } = {}

    const gws = bootnodesContentUri ? await fetchFromBootNode(bootnodesContentUri) : await fetchDefaultBootNode()

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
export function fetchDefaultBootNode(): Promise<GatewayBootNodes> {
    return fetchFileString(defaultBootnodeContentUri).then(strResult => {
        const result = JSON.parse(strResult)
        return result
    }).catch(err => {
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
export async function getActiveEntityGateways(entityAddress: string): Promise<GatewayInfo[]> {
    throw new Error("TODO: unimplemented") // TODO: getActiveEntityGateways()
}
