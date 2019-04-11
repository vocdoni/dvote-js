import { providers, utils } from "ethers"
import { EntityResolver as EntityContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"

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
    constructor(params: EntityConstructorParams) {
        if (!params) throw new Error("Invalid parameters")

        const { web3Provider, providerUrl, provider, privateKey, mnemonic, mnemonicPath } = params

        super({
            abi,
            bytecode,

            web3Provider,
            providerUrl,
            provider,
            
            privateKey,
            mnemonic,
            mnemonicPath
        })
    }

    public static getEntityId(entityAddress: string): string {
        return utils.keccak256(entityAddress)
    }
}

export enum TextRecordKeys {
    NAME = "vnd.vocdoni.entity-name",
    LANGUAGES = "vnd.vocdoni.languages",
    JSON_META_CONTENT_URI = "vnd.vocdoni.meta",
    VOTING_CONTRACT_ADDRESS = "vnd.vocdoni.voting-contract",
    GATEWAYS_UPDATE_CONFIG = "vnd.vocdoni.gateway-update",
    ACTIVE_PROCESS_IDS = "vnd.vocdoni.process-ids.active",
    ENDED_PROCESS_IDS = "vnd.vocdoni.process-ids.ended",
    NEWS_FEED_CONTENT_URI = "vnd.vocdoni.news-feed.en",
    // ___ = "vnd.vocdoni.news-feed.fr",
    DESCRIPTION = "vnd.vocdoni.entity-description.en",
    // ___ = "vnd.vocdoni.entity-description.fr",
    AVATAR_CONTENT_URI = "vnd.vocdoni.avatar",
}

export enum TextListRecordKeys {
    GATEWAY_BOOT_NODES = "vnd.vocdoni.gateway-boot-nodes",
    BOOT_ENTITIES = "vnd.vocdoni.boot-entities",
    FALLBACK_BOOTNODE_ENTITIES = "vnd.vocdoni.fallback-bootnodes-entities",
    TRUSTED_ENTITIES = "vnd.vocdoni.trusted-entities",
    CENSUS_SERVICES = "vnd.vocdoni.census-services",
    CENSUS_SERVICE_SOURCE_ENTITIES = "vnd.vocdoni.census-service-source-entities",
    CENSUS_IDS = "vnd.vocdoni.census-ids",
    CENSUS_MANAGER_KEYS = "vnd.vocdoni.census-manager-keys",
    RELAYS = "vnd.vocdoni.relays",
}
