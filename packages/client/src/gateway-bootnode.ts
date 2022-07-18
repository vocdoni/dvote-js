// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { getEnsTextRecord } from "./net/ens"
import { ContentUri } from "./wrappers/content-uri"
import { FileApi } from "./apis/file"
import {
    AVAX_CHAIN_ID,
    AVAX_ENS_REGISTRY_ADDRESS,
    AVAX_FUJI_CHAIN_ID,
    AVAX_FUJI_ENS_REGISTRY_ADDRESS,
    AVAX_FUJI_PROVIDER,
    AVAX_PROVIDER,
    EthNetworkID,
    SOKOL_CHAIN_ID,
    SOKOL_ENS_REGISTRY_ADDRESS,
    SOKOL_PROVIDER_URI,
    VocdoniEnvironment,
    XDAI_CHAIN_ID,
    XDAI_ENS_REGISTRY_ADDRESS,
    XDAI_PROVIDER_URI,
    XDAI_STG_ENS_REGISTRY_ADDRESS,
    MATIC_CHAIN_ID,
    MATIC_ENS_REGISTRY_ADDRESS,
    MATIC_PROVIDER_URI,
    // MUMBAI_CHAIN_ID,
    // MUMBAI_ENS_REGISTRY_ADDRESS,
    // MUMBAI_PROVIDER_URI
} from "@vocdoni/common"
import { JsonBootnodeData } from "./apis/definition"
import { TextRecordKeys, promiseAny } from "@vocdoni/common"
import { DVoteGateway } from "./gateway-dvote"
import { Web3Gateway } from "./gateway-web3"
import { getDefaultProvider, providers } from "ethers"

export namespace GatewayBootnode {
    /**
     * Retrieve the list of gateways provided by default by Vocdoni in the network
     * @param networkId The Ethereum network to which the gateways should be associated
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    export function getDefaultGateways(networkId: EthNetworkID = "xdai", environment: VocdoniEnvironment = "prod"): Promise<JsonBootnodeData> {
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
    export function getDefaultUri(networkId: EthNetworkID = "xdai", environment: VocdoniEnvironment = "prod"): Promise<ContentUri> {
        let provider: providers.BaseProvider

        switch (networkId) {
            case "homestead":
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
            case "avalanche":
                provider = new providers.StaticJsonRpcProvider(AVAX_PROVIDER, { chainId: AVAX_CHAIN_ID, name: "fuji", ensAddress: AVAX_ENS_REGISTRY_ADDRESS });
                break;
            case "fuji":
                provider = new providers.StaticJsonRpcProvider(AVAX_FUJI_PROVIDER, { chainId: AVAX_FUJI_CHAIN_ID, name: "avalanche", ensAddress: AVAX_FUJI_ENS_REGISTRY_ADDRESS });
                break
            case "matic":
                provider = new providers.StaticJsonRpcProvider(MATIC_PROVIDER_URI, { chainId: MATIC_CHAIN_ID, name: "matic", ensAddress: MATIC_ENS_REGISTRY_ADDRESS });
                break
            // case "mumbai":
            //     provider = new providers.StaticJsonRpcProvider(MUMBAI_PROVIDER_URI, { chainId: MUMBAI_CHAIN_ID, name: "mumbai", ensAddress: MUMBAI_ENS_REGISTRY_ADDRESS });
            //     break
            default: throw new Error("Unsupported Network ID")
        }

        const gw = new Web3Gateway(provider, networkId, environment)

        return getEnsTextRecord(gw, TextRecordKeys.VOCDONI_BOOT_NODES, { environment, networkId })
            .then((uri: string) => {
                if (!uri) {
                    throw new Error("The boot nodes Content URI is not defined on " + networkId)
                }
                return new ContentUri(uri)
            })
    }

    /**
     * Retrieve the list of gateways based on a Bootnode Content URI
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @returns A JsonBootnodeData object that represents the ata derrived from a Bootnode Content URI.
     */
    export function getGatewaysFromUri(bootnodesContentUri: string | ContentUri | string[] | ContentUri[]): Promise<JsonBootnodeData> {
        if (!bootnodesContentUri) return Promise.reject(new Error("Invalid bootNodeUri"))

        const bootnodesResult = Array.isArray(bootnodesContentUri) ? bootnodesContentUri.map(uri => FileApi.fetchString(uri)) : [FileApi.fetchString(bootnodesContentUri)]

        return promiseAny(bootnodesResult)
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
    export function digest(bootnodeData: JsonBootnodeData, environment: VocdoniEnvironment = "prod"): { [networkId: string]: { dvote: DVoteGateway[], web3: Web3Gateway[] } } {
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
    export function digestNetwork(bootnodeData: JsonBootnodeData, networkId: string, environment: VocdoniEnvironment = "prod"): { dvote: DVoteGateway[], web3: Web3Gateway[] } {
        if (!bootnodeData || typeof bootnodeData[networkId] != "object") return { dvote: [], web3: [] }

        return {
            dvote: (bootnodeData[networkId].dvote || []).map(item => {
                return new DVoteGateway({ uri: item.uri, supportedApis: item.apis, publicKey: item.pubKey, environment })
            }),
            web3: (bootnodeData[networkId].web3 || []).map(item => {
                return new Web3Gateway(item.uri, networkId as EthNetworkID, environment)
            })
        }
    }
}
