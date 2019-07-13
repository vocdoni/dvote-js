import { providers, utils, Wallet, Signer } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { VocGateway } from "../net/gateway"
import { getEntityResolverInstance } from "../net/contract"
import { TextRecordKeys } from "../models/entity"
import { fetchFileString, addFile } from "./file"
import GatewayURI from "../util/gateway-uri"

export {
    deployEntityContract,
    getEntityResolverInstance
} from "../net/contract"

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
 * Fetch the JSON metadata file for the given entityAddress using the given gateway
 * @param entityAddress 
 * @param gatewayUri URI of a Vocdoni Gateway to fetch the data from
 */
export async function getEntityMetadata(entityAddress: string, resolverContractAddress: string, gatewayUri: GatewayURI): Promise<EntityMetadata> {
    if (!entityAddress) throw new Error("Invalid entityAddress")
    else if (!resolverContractAddress) throw new Error("Invalid resolverContractAddress")
    else if (!gatewayUri || !(gatewayUri instanceof GatewayURI)) throw new Error("Invalid Gateway URI object")

    const entityId = getEntityId(entityAddress)
    const resolverInstance = getEntityResolverInstance({ gatewayUri: gatewayUri.web3 }, resolverContractAddress)

    const metadataContentUri = await resolverInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI)
    if (!metadataContentUri) throw new Error("The given entity has no metadata defined yet")

    const gw = new VocGateway(gatewayUri.dvote)
    const jsonBuffer = await fetchFileString(metadataContentUri, gw)
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
 * @return A content URI with the IPFS origin
 */
export async function updateEntity(entityAddress: string, resolverContractAddress: string, entityMetadata: EntityMetadata,
    walletOrSigner: Wallet | Signer, gatewayUri: GatewayURI): Promise<string> {
    if (!entityAddress) throw new Error("Invalid entityAddress")
    else if (!entityMetadata) throw new Error("Invalid Entity metadata")

    // throw if not valid
    checkValidEntityMetadata(entityMetadata)

    const strJsonMeta = JSON.stringify(entityMetadata)
    const gw = new VocGateway(gatewayUri.dvote)
    const ipfsUri = await addFile(strJsonMeta, "entity-metadata.json", walletOrSigner, gw)
    gw.disconnect()

    // Set the IPFS origin on the blockchain
    const resolverInstance = getEntityResolverInstance({ gatewayUri: gatewayUri.web3 }, resolverContractAddress)

    const entityId = getEntityId(entityAddress)
    const tx = await resolverInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

    // TODO: Unpin oldMetaContentUri

    await tx.wait()
    return ipfsUri
}
