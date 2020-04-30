import { utils, Wallet, Signer } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { Gateway, IGateway, Web3Gateway, IWeb3Gateway } from "../net/gateway"
import { TextRecordKeys } from "../models/entity"
import { fetchFileString, addFile } from "./file"
import { IGatewayPool, GatewayPool } from "../net/gateway-pool"

/**
 * Computes the ID of an entity given its address
 * @param entityAddress 
 */
export function getEntityId(entityAddress: string): string {
    return utils.keccak256(entityAddress)
}

/**
 * Asserts that the given object is a valid Entity JSON metadtata.
 * Throws an exception if it is not.
 */
export function checkValidMetadata(entityMetadata: EntityMetadata) {
    return checkValidEntityMetadata(entityMetadata)
}

/**
 * Fetch the JSON metadata file for the given entity ID using the given gateway instances
 * @param entityId 
 * @param web3Gateway Web3Gateway instance already connected
 * @param dboteGateway Gateway instance already connected to an active service
 */
export async function getEntityMetadata(entityId: string, gateway: Gateway | IGatewayPool): Promise<EntityMetadata> {
    if (!entityId) return Promise.reject(new Error("Invalid entityAddress"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    const resolverInstance = await gateway.getEntityResolverInstance()

    const metadataContentUri = await resolverInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI)
    if (!metadataContentUri) return Promise.reject(new Error("The given entity has no metadata defined yet"))

    const jsonBuffer = await fetchFileString(metadataContentUri, gateway)

    return JSON.parse(jsonBuffer.toString())
}

/**
 * Fetch the JSON metadata file for the given entity address using the given gateway instances
 * @param entityAddress 
 * @param web3Gateway Web3Gateway instance already connected
 * @param dboteGateway Gateway instance already connected to an active service
 */
export function getEntityMetadataByAddress(entityAddress: string, gateway: Gateway | IGatewayPool): Promise<EntityMetadata> {
    if (!entityAddress) return Promise.reject(new Error("Invalid entityAddress"))

    const entityId = getEntityId(entityAddress)
    return getEntityMetadata(entityId, gateway)
}

/**
 * Update the ENS fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
 * Throws an Error if the schema does not match
 * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
 * @return A content URI with the IPFS origin
 */
export async function updateEntity(entityAddress: string, entityMetadata: EntityMetadata,
    walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
    if (!entityAddress) return Promise.reject(new Error("Invalid entityAddress"))
    else if (!entityMetadata) return Promise.reject(new Error("Invalid Entity metadata"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    // throw if not valid
    checkValidEntityMetadata(entityMetadata)
    const strJsonMeta = JSON.stringify(entityMetadata)

    if (walletOrSigner instanceof Wallet && !walletOrSigner.provider) {
        walletOrSigner = walletOrSigner.connect(gateway.getProvider())
    }

    const ipfsUri = await addFile(strJsonMeta, "entity-metadata.json", walletOrSigner, gateway)

    // Set the IPFS origin on the blockchain
    const resolverInstance = await gateway.getEntityResolverInstance(walletOrSigner)

    const entityId = getEntityId(entityAddress)
    const tx = await resolverInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

    // TODO: Unpin oldMetaContentUri

    await tx.wait()
    return ipfsUri
}
