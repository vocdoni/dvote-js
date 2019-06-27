import { providers, utils, Wallet } from "ethers"
import { EntityResolver as EntityContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"
import Gateway from "./gateway"
import { EntityMetadata, EntityResolverFields, TextRecordKeys, TextListRecordKeys, EntityCustomAction } from "../lib/metadata-types";

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
     * Fetch the JSON metadata file for the given entityAddress using the given gateway
     * @param entityAddress 
     * @param gatewayUri URI of a Vocdoni Gateway to fetch the data from
     */
    public async fetchJsonMetadata(entityAddress: string, gatewayUri: string): Promise<EntityMetadata> {
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
     * Fetch the entire collection of ENS resolver fields for the given entityAddress using the attached provider
     * @param entityAddress 
     */
    public async fetchAllFields(entityAddress: string): Promise<EntityResolverFields> {
        if (!entityAddress) throw new Error("Invalid entityAddress")

        const entityId = EntityResolver.getEntityId(entityAddress)

        const result = {
            // STRINGS
            [TextRecordKeys.LANGUAGES]: JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.LANGUAGES)),
            [TextRecordKeys.JSON_METADATA_CONTENT_URI]: await this.contractInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI),
            [TextRecordKeys.VOTING_CONTRACT_ADDRESS]: await this.contractInstance.text(entityId, TextRecordKeys.VOTING_CONTRACT_ADDRESS),
            [TextRecordKeys.GATEWAYS_UPDATE_CONFIG]: JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.GATEWAYS_UPDATE_CONFIG)),
            [TextRecordKeys.ACTIVE_PROCESS_IDS]: JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.ACTIVE_PROCESS_IDS)),
            [TextRecordKeys.ENDED_PROCESS_IDS]: JSON.parse(await this.contractInstance.text(entityId, TextRecordKeys.ENDED_PROCESS_IDS)),
            [TextRecordKeys.AVATAR_CONTENT_URI]: await this.contractInstance.text(entityId, TextRecordKeys.AVATAR_CONTENT_URI),

            // STRING ARRAYS
            [TextListRecordKeys.BOOT_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.BOOT_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            [TextListRecordKeys.CENSUS_IDS]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_IDS),
            [TextListRecordKeys.CENSUS_MANAGER_KEYS]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_MANAGER_KEYS),
            [TextListRecordKeys.CENSUS_SERVICES]: await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICES),
            [TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            [TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
            [TextListRecordKeys.GATEWAY_BOOT_NODES]: (await this.contractInstance.list(entityId, TextListRecordKeys.GATEWAY_BOOT_NODES)).map(entry => JSON.parse(entry || "{}")),
            [TextListRecordKeys.RELAYS]: (await this.contractInstance.list(entityId, TextListRecordKeys.RELAYS)).map(entry => JSON.parse(entry || "{}")),
            [TextListRecordKeys.TRUSTED_ENTITIES]: (await this.contractInstance.list(entityId, TextListRecordKeys.TRUSTED_ENTITIES)).map(entry => JSON.parse(entry || "{}")),
        }

        // language dependent fields
        for (let lang of result[TextRecordKeys.LANGUAGES]) {
            result[TextRecordKeys.NAME_PREFIX + lang] = await this.contractInstance.text(entityId, TextRecordKeys.NAME_PREFIX + lang)
            result[TextRecordKeys.NEWS_FEED_URI_PREFIX + lang] = await this.contractInstance.text(entityId, TextRecordKeys.NEWS_FEED_URI_PREFIX + lang)
            result[TextRecordKeys.DESCRIPTION_PREFIX + lang] = await this.contractInstance.text(entityId, TextRecordKeys.DESCRIPTION_PREFIX + lang)
        }

        return result as EntityResolverFields;
    }

    /**
     * Update the ENS fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
     * @param entityAddress 
     * @param entityFields
     */
    public async updateEntity(entityAddress: string, entityFields: EntityResolverFields, entityActions: EntityCustomAction[], gatewayUri: string): Promise<EntityResolverFields> {
        if (!entityAddress) throw new Error("Invalid entityAddress")
        else if (!entityFields) throw new Error("Invalid Entity Fields")

        // const oldMetaContentUri = entityFields[TextRecordKeys.JSON_METADATA_CONTENT_URI]

        const entityId = EntityResolver.getEntityId(entityAddress)
        let str: string, strings: string[], tx: any, waiters: Promise<void>[] = []

        // STRINGS

        str = await this.contractInstance.text(entityId, TextRecordKeys.LANGUAGES)
        if (str != JSON.stringify(entityFields[TextRecordKeys.LANGUAGES])) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.LANGUAGES, JSON.stringify(entityFields[TextRecordKeys.LANGUAGES]))
            waiters.push(tx.wait())
        }

        if (entityFields[TextRecordKeys.JSON_METADATA_CONTENT_URI]) {
            console.log("Warning: ignoring meta field vnd.vocdoni.meta")
        }

        str = await this.contractInstance.text(entityId, TextRecordKeys.VOTING_CONTRACT_ADDRESS)
        if (str != entityFields[TextRecordKeys.VOTING_CONTRACT_ADDRESS]) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.VOTING_CONTRACT_ADDRESS, entityFields[TextRecordKeys.LANGUAGES])
            waiters.push(tx.wait())
        }
        str = await this.contractInstance.text(entityId, TextRecordKeys.GATEWAYS_UPDATE_CONFIG)
        if (str != JSON.stringify(entityFields[TextRecordKeys.GATEWAYS_UPDATE_CONFIG])) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.GATEWAYS_UPDATE_CONFIG, JSON.stringify(entityFields[TextRecordKeys.LANGUAGES]))
            waiters.push(tx.wait())
        }
        str = await this.contractInstance.text(entityId, TextRecordKeys.ACTIVE_PROCESS_IDS)
        if (str != JSON.stringify(entityFields[TextRecordKeys.ACTIVE_PROCESS_IDS])) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.ACTIVE_PROCESS_IDS, JSON.stringify(entityFields[TextRecordKeys.LANGUAGES]))
            waiters.push(tx.wait())
        }
        str = await this.contractInstance.text(entityId, TextRecordKeys.ENDED_PROCESS_IDS)
        if (str != JSON.stringify(entityFields[TextRecordKeys.ENDED_PROCESS_IDS])) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.ENDED_PROCESS_IDS, JSON.stringify(entityFields[TextRecordKeys.LANGUAGES]))
            waiters.push(tx.wait())
        }
        str = await this.contractInstance.text(entityId, TextRecordKeys.AVATAR_CONTENT_URI)
        if (str != entityFields[TextRecordKeys.AVATAR_CONTENT_URI]) {
            tx = await this.contractInstance.setText(entityId, TextRecordKeys.AVATAR_CONTENT_URI, entityFields[TextRecordKeys.LANGUAGES])
            waiters.push(tx.wait())
        }

        // STRING ARRAYS

        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.BOOT_ENTITIES)) // .map(entry => JSON.parse(entry || "{}"))
        // strings = await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_IDS)
        // strings = await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_MANAGER_KEYS)
        // strings = await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICES)
        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES)) // .map(entry => JSON.parse(entry || "{}"))
        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES)) // .map(entry => JSON.parse(entry || "{}"))
        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.GATEWAY_BOOT_NODES)) // .map(entry => JSON.parse(entry || "{}"))
        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.TRUSTED_ENTITIES)) // .map(entry => JSON.parse(entry || "{}"))

        // TODO: Check changes on the Gateway boot nodes
        // if (entityFields[TextListRecordKeys.GATEWAY_BOOT_NODES].some((value, i) => JSON.stringify(value) != strings[i])) {
        //     await Promise.all(entityFields[TextListRecordKeys.GATEWAY_BOOT_NODES].map())
        // }
        // TODO: Check changes on the Relays
        // strings = (await this.contractInstance.list(entityId, TextListRecordKeys.RELAYS)) // .map(entry => JSON.parse(entry || "{}"))
        // if (entityFields[TextListRecordKeys.RELAYS].some((value, i) => JSON.stringify(value) != strings[i])) {
        //     await Promise.all(entityFields[TextListRecordKeys.RELAYS].map())
        // }

        // language dependent fields
        for (let lang of entityFields[TextRecordKeys.LANGUAGES]) {
            str = await this.contractInstance.text(entityId, TextRecordKeys.NAME_PREFIX + lang)
            if (str != entityFields[TextRecordKeys.NAME_PREFIX + lang]) {
                tx = await this.contractInstance.setText(entityId, TextRecordKeys.NAME_PREFIX + lang, entityFields[TextRecordKeys.NAME_PREFIX + lang] || "")
                waiters.push(tx.wait())
            }

            str = await this.contractInstance.text(entityId, TextRecordKeys.DESCRIPTION_PREFIX + lang)
            if (str != entityFields[TextRecordKeys.DESCRIPTION_PREFIX + lang]) {
                tx = await this.contractInstance.setText(entityId, TextRecordKeys.DESCRIPTION_PREFIX + lang, entityFields[TextRecordKeys.DESCRIPTION_PREFIX + lang] || "")
                waiters.push(tx.wait())
            }

            str = await this.contractInstance.text(entityId, TextRecordKeys.NEWS_FEED_URI_PREFIX + lang)
            if (str != entityFields[TextRecordKeys.NEWS_FEED_URI_PREFIX + lang]) {
                tx = await this.contractInstance.setText(entityId, TextRecordKeys.NEWS_FEED_URI_PREFIX + lang, entityFields[TextRecordKeys.NEWS_FEED_URI_PREFIX + lang] || "")
                waiters.push(tx.wait())
            }
        }

        await Promise.all(waiters)

        // Generate the IPFS payload
        const jsonMeta = EntityResolver.fromEnsToJson(entityFields, entityActions)
        const strJsonMeta = JSON.stringify(jsonMeta)
        const gw = new Gateway(gatewayUri)
        const ipfsUri = await gw.addFile(strJsonMeta, "entity-meta.json", "ipfs", this.wallet as Wallet)
        gw.disconnect()

        // Set the IPFS has on the blockchain
        await this.contractInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)


        // TODO: Unpin oldMetaContentUri

        return this.fetchAllFields(entityAddress)
    }

    // STATIC METHODS

    /**
     * Convert a JSON object with Entity Metadata into an object
     * containing the ENS key-values
     */
    public static fromJsonToEnsFields(jsonMetadata: EntityMetadata, metaContentUri: string): EntityResolverFields {
        let result: EntityResolverFields = {
            // STRINGS
            [TextRecordKeys.LANGUAGES]: jsonMetadata.languages,
            [TextRecordKeys.JSON_METADATA_CONTENT_URI]: metaContentUri,
            [TextRecordKeys.VOTING_CONTRACT_ADDRESS]: jsonMetadata["voting-contract"],
            [TextRecordKeys.GATEWAYS_UPDATE_CONFIG]: jsonMetadata["gateway-update"],
            [TextRecordKeys.ACTIVE_PROCESS_IDS]: jsonMetadata["process-ids"].active,
            [TextRecordKeys.ENDED_PROCESS_IDS]: jsonMetadata["process-ids"].ended,
            [TextRecordKeys.AVATAR_CONTENT_URI]: jsonMetadata.avatar,

            // LANGUAGE DEPENDENT STRINGS
            // FIXME: Use language dependent variants
            [TextRecordKeys.NAME_PREFIX + "default"]: jsonMetadata.name.default,
            [TextRecordKeys.DESCRIPTION_PREFIX + "default"]: jsonMetadata.description.default,
            [TextRecordKeys.NEWS_FEED_URI_PREFIX + "default"]: jsonMetadata["news-feed"].default,


            // STRING ARRAYS
            [TextListRecordKeys.BOOT_ENTITIES]: [],
            [TextListRecordKeys.CENSUS_IDS]: [],
            [TextListRecordKeys.CENSUS_MANAGER_KEYS]: [],
            [TextListRecordKeys.CENSUS_SERVICES]: [],
            [TextListRecordKeys.CENSUS_SERVICE_SOURCE_ENTITIES]: [],
            [TextListRecordKeys.FALLBACK_BOOTNODE_ENTITIES]: [],
            [TextListRecordKeys.GATEWAY_BOOT_NODES]: jsonMetadata["gateway-boot-nodes"],
            [TextListRecordKeys.RELAYS]: jsonMetadata.relays,
            [TextListRecordKeys.TRUSTED_ENTITIES]: [],
        } as any
        return result
    }

    /**
     * Convert a set of ENS text records into an Entity Metadata JSON
     */
    public static fromEnsToJson(entityFields: EntityResolverFields, entityActions: EntityCustomAction[] = []): EntityMetadata {
        const result: EntityMetadata = {
            version: "1.0",
            languages: entityFields[TextRecordKeys.LANGUAGES],
            "voting-contract": entityFields[TextRecordKeys.VOTING_CONTRACT_ADDRESS],
            "gateway-update": entityFields[TextRecordKeys.GATEWAYS_UPDATE_CONFIG],
            "process-ids": {
                active: entityFields[TextRecordKeys.ACTIVE_PROCESS_IDS],
                ended: entityFields[TextRecordKeys.ENDED_PROCESS_IDS]
            },
            avatar: entityFields[TextRecordKeys.AVATAR_CONTENT_URI],

            // Language-dependent ENS fields
            // FIXME: Use language dependent keys
            name: entityFields[TextRecordKeys.NAME_PREFIX + "default"],
            description: entityFields[TextRecordKeys.DESCRIPTION_PREFIX + "default"],
            "news-feed": entityFields[TextRecordKeys.NEWS_FEED_URI_PREFIX + "default"],

            // Bootnodes providing a list of active Gateways
            "gateway-boot-nodes": entityFields[TextListRecordKeys.GATEWAY_BOOT_NODES],

            // List of currently active Relays. This list is just for informational purposes.
            // The effective list of relays for a voting process is on the Voting Process smart contract
            relays: entityFields[TextListRecordKeys.RELAYS],

            // List of custom interactions that the entity defines.
            // It may include anything like visiting web sites, uploading pictures, making payments, etc.
            actions: entityActions
        }

        return result
    }
}
