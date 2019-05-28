import { providers, utils } from "ethers"
import { EntityResolver as EntityContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"
import Gateway from "./gateway"
import { EntityMetadata } from "lib/metadata-types";

const { abi, bytecode } = EntityContractDefinition

type EntityConstructorParams = {
    // connectivity
    web3Provider?: providers.Web3Provider,  // for window.web3.currentProvider
    providerUrl?: string,                   // URL's like http://localhost:8545
    provider?: providers.Provider,          // specific ethers.js provider

    // wallet
    privateKey?: string,
    mnemonic?: string,
    mnemonicPath?: string                   // Derivation path
}

/**
 * The class extends the behavior of the SmartContract base class
 */
export default class EntityResolver extends SmartContract {
    // STATIC

    /**
     * Computes the ID of an entity given its address
     * @param entityAddress 
     */
    public static getEntityId(entityAddress: string): string {
        return utils.keccak256(entityAddress)
    }

    /**
     * Retrieve a list of curently active gateways for the given entityAddress
     * @param provider 
     * @param resolverAddress 
     * @param entityId 
     */
    public static async getActive(provider: providers.Provider, resolverAddress: string, entityAddress: string): Promise<{ ipAddress: string, port: number, publicKey: string }[]> {
        throw new Error("unimplemented") // TODO:
    }

    // METHODS

    /**
     * Creates a contract factory to deploy or attach to EntityResolver instances
     * @param params 
     */
    constructor(params: EntityConstructorParams) {
        if (!params) throw new Error("Invalid parameters")

        const { web3Provider, providerUrl, provider, privateKey, mnemonic, mnemonicPath } = params

        super({
            // mandatory
            abi,
            bytecode,

            // one of
            web3Provider,
            providerUrl,
            provider,

            // optional for read-only
            privateKey,
            mnemonic,
            mnemonicPath
        })
    }

    /**
     * Fetch the JSON metadata for the given entityAddress using the given gateway
     * @param entityAddress 
     * @param gatewayUri URI of a Vocdoni Gateway to fetch the data from
     */
    public async getJsonMetadata(entityAddress: string, gatewayUri: string): Promise<EntityMetadata> {
        if (!entityAddress) throw new Error("Invalid entityAddress")
        else if (!gatewayUri) throw new Error("Invalid gateway IP")

        const entityId = EntityResolver.getEntityId(entityAddress)
        const metadataContentUri = await this.contractInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI)
        if (!metadataContentUri) throw new Error("The given entity has no metadata defined yet")

        const gw = new Gateway(gatewayUri)
        const jsonBuffer = await gw.fetchFile(metadataContentUri)
        gw.disconnect()

        return JSON.parse(jsonBuffer.toString())
    }

    /**
     * Fetch the JSON metadata for the given entityAddress using the given gateway
     * @param entityAddress 
     */
    public async getResolverFields(entityAddress: string): Promise<EntityMetadata> {
        if (!entityAddress) throw new Error("Invalid entityAddress")

        const entityId = EntityResolver.getEntityId(entityAddress)

        const result: EntityMetadata = {
            "version": "1.0",
            // STRINGS
            "languages": JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.LANGUAGES)),
            "entity-name": await this.contractInstance.text(entityId, TextRecordKeys.NAME),
            "entity-description": {},
            // "meta": await this.contractInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI),
            "voting-contract": await this.contractInstance.text(entityId, TextRecordKeys.VOTING_CONTRACT_ADDRESS),
            "gateway-update": JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.GATEWAYS_UPDATE_CONFIG)),
            "process-ids": {
                "active": JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.ACTIVE_PROCESS_IDS)),
                "ended": JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.ENDED_PROCESS_IDS)),
            },
            "news-feed": {},
            "avatar": await this.contractInstance.text(entityId, TextRecordKeys.AVATAR_CONTENT_URI),

            // STRING ARRAYS
            "gateway-boot-nodes": (await this.contractInstance.list(entityId, TextListRecordKeys.BOOT_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            // [TextListRecordKeys.CENSUS_IDS]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_IDS),
            // [TextListRecordKeys.CENSUS_MANAGER_KEYS]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_MANAGER_KEYS),
            // [TextListRecordKeys.CENSUS_SERVICES]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICES),
            // [TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            // [TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            // [TextListRecordKeys.GATEWAY_BOOT_NODES]: (await this.contractInstance.list(entityId, TextListRecordKeys.GATEWAY_BOOT_NODES)).map(entry => JSON.parse(entry || "{}")),
            "relays": (await this.contractInstance.list(entityId, TextListRecordKeys.RELAYS)).map(entry => JSON.parse(entry || "{}")),
            // [TextListRecordKeys.TRUSTED_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.TRUSTED_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            "actions": [] // Defined on the JSON version only
        }

        // language dependent fields
        for (let lang of result.languages) {
            result["news-feed"][lang] = await this.contractInstance.text(entityId, TextRecordKeys.NEWS_FEED_URI_PREFIX + lang)
            result["entity-description"][lang] = await this.contractInstance.text(entityId, TextRecordKeys.DESCRIPTION_PREFIX + lang)
        }

        return result;
    }
}

// ENS KEYS

export const TextRecordKeys = {
    NAME: "vnd.vocdoni.entity-name",
    LANGUAGES: "vnd.vocdoni.languages",
    JSON_METADATA_CONTENT_URI: "vnd.vocdoni.meta",
    VOTING_CONTRACT_ADDRESS: "vnd.vocdoni.voting-contract",
    GATEWAYS_UPDATE_CONFIG: "vnd.vocdoni.gateway-update",
    ACTIVE_PROCESS_IDS: "vnd.vocdoni.process-ids.active",
    ENDED_PROCESS_IDS: "vnd.vocdoni.process-ids.ended",
    NEWS_FEED_URI_PREFIX: "vnd.vocdoni.news-feed.", // + lang
    DESCRIPTION_PREFIX: "vnd.vocdoni.entity-description.", // + lang
    AVATAR_CONTENT_URI: "vnd.vocdoni.avatar",
}

export const TextListRecordKeys = {
    GATEWAY_BOOT_NODES: "vnd.vocdoni.gateway-boot-nodes",
    BOOT_ENTITIES: "vnd.vocdoni.boot-entities",
    FALLBACK_BOOTNODE_ENTITIES: "vnd.vocdoni.fallback-bootnodes-entities",
    TRUSTED_ENTITIES: "vnd.vocdoni.trusted-entities",
    CENSUS_SERVICES: "vnd.vocdoni.census-services",
    CENSUS_SERVICE_SOURCE_ENTITIES: "vnd.vocdoni.census-service-source-entities",
    CENSUS_IDS: "vnd.vocdoni.census-ids",
    CENSUS_MANAGER_KEYS: "vnd.vocdoni.census-manager-keys",
    RELAYS: "vnd.vocdoni.relays",
}
