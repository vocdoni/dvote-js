import { providers, utils, Wallet } from "ethers"
import { EntityResolver as EntityContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"
import Gateway from "./gateway"
import { EntityMetadata, TextRecordKeys, EntityCustomAction } from "../lib/metadata-types";
import { checkValidEntityMetadata } from "lib/json-schema";

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
     * @param entityAddress 
     * @param entityMetadata
     */
    public async updateEntity(entityAddress: string, entityMetadata: EntityMetadata, entityActions: EntityCustomAction[], gatewayUri: string): Promise<EntityMetadata> {
        if (!entityAddress) throw new Error("Invalid entityAddress")
        else if (!entityMetadata) throw new Error("Invalid Entity metadata")

        // throw if not valid
        EntityResolver.checkValidMetadata(entityMetadata)

        const strJsonMeta = JSON.stringify(entityMetadata)
        const gw = new Gateway(gatewayUri)
        const ipfsUri = await gw.addFile(strJsonMeta, "entity-meta.json", "ipfs", this.wallet as Wallet)
        gw.disconnect()

        // Set the IPFS origin on the blockchain
        const entityId = EntityResolver.getEntityId(entityAddress)
        const tx = await this.contractInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

        // TODO: Unpin oldMetaContentUri

        return tx.wait()
    }

    // STATIC METHODS

    /**
     * Asserts that the given metadata is valid.
     * Throws an exception if it is not.
     */
    public static checkValidMetadata(entityMetadata: EntityMetadata) {
        return checkValidEntityMetadata(entityMetadata)
    }
}

