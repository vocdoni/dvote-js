import { providers, utils, Wallet } from "ethers"
import { EntityResolver as EntityContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"
import Gateway from "./gateway"
import { EntityMetadata, TextRecordKeys, EntityCustomAction } from "../lib/metadata-types";
import { checkValidEntityMetadata } from "../lib/json-schema";

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

/** Custom Smart Contract operations for an Entity Resolver contract */
type EntityResolverContractMethods = {
    /**
     * Returns the text associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(entityId: string, key: string): Promise<string>
    /**
     * Returns the list associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @return The list array of values.
     */
    list(entityId: string, key: string): Promise<string[]>
    /**
     * Returns the text associated with an ENS node, key and index.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @param index The index within the list to retrieve.
     * @return The list entry's text value.
     */
    listText(entityId: string, key: string, index: number): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(entityId: string, key: string, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Sets the text of the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index of the list to set.
     * @param value The text to store.
     */
    setListText(entityId: string, key: string, index: number, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Appends a new value on the given ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param value The text to store.
     */
    pushListText(entityId: string, key: string, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Removes the value on the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * Note: This may cause items to be arranged in a different order.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index to remove.
     */
    removeListIndex(entityId: string, key: string, index: number): Promise<{ wait: () => Promise<any> }>
}

/**
 * The class extends the behavior of the SmartContract base class
 */
export default class EntityResolver extends SmartContract<EntityResolverContractMethods> {
    ///////////////////////////////////////////////////////////////////////////
    // STATIC
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Computes the ID of an entity given its address
     * @param entityAddress 
     */
    public static getEntityId(entityAddress: string): string {
        return utils.keccak256(entityAddress)
    }

    /**
     * Asserts that the given metadata is valid.
     * Throws an exception if it is not.
     */
    public static checkValidMetadata(entityMetadata: EntityMetadata) {
        return checkValidEntityMetadata(entityMetadata)
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

    ///////////////////////////////////////////////////////////////////////////
    // METHODS
    ///////////////////////////////////////////////////////////////////////////

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
    public async getMetadata(entityAddress: string, gatewayUri: string): Promise<EntityMetadata> {
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
     * Update the ENS fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
     * Throws an Error if the schema does not match
     * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
     * @param entityAddress 
     * @param entityMetadata 
     * @param dvoteGatewayUri 
     */
    public async updateEntity(entityAddress: string, entityMetadata: EntityMetadata, dvoteGatewayUri: string): Promise<void> {
        if (!entityAddress) throw new Error("Invalid entityAddress")
        else if (!entityMetadata) throw new Error("Invalid Entity metadata")

        // throw if not valid
        EntityResolver.checkValidMetadata(entityMetadata)

        const strJsonMeta = JSON.stringify(entityMetadata)
        const gw = new Gateway(dvoteGatewayUri)
        const ipfsUri = await gw.addFile(strJsonMeta, "entity-meta.json", "ipfs", this.wallet as Wallet)
        gw.disconnect()

        // Set the IPFS origin on the blockchain
        const entityId = EntityResolver.getEntityId(entityAddress)
        const tx = await this.contractInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

        // TODO: Unpin oldMetaContentUri

        await tx.wait()
    }
}

