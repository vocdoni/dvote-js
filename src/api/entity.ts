import { utils, Wallet, Signer } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { DVoteGateway, Web3Gateway } from "../net/gateway"
import { getEntityResolverInstance } from "../net/contracts"
import { TextRecordKeys } from "../models/entity"
import { fetchFileString, addFile } from "./file"
import GatewayInfo from "../wrappers/gateway-info"

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
 * @param entityId 
 * @param gatewayInfo Data of the Vocdoni Gateway to fetch the data from
 */
export async function getEntityMetadata(entityId: string, gatewayInfo: GatewayInfo): Promise<EntityMetadata> {
    if (!entityId) throw new Error("Invalid entityAddress")
    else if (!gatewayInfo || !(gatewayInfo instanceof GatewayInfo)) throw new Error("Invalid Gateway URI object")

    const web3 = new Web3Gateway(gatewayInfo)
    const resolverInstance = await getEntityResolverInstance({ provider: web3.getProvider() })

    const metadataContentUri = await resolverInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI)
    if (!metadataContentUri) throw new Error("The given entity has no metadata defined yet")

    const gw = new DVoteGateway(gatewayInfo)
    await gw.connect()
    const jsonBuffer = await fetchFileString(metadataContentUri, gw)
    gw.disconnect()

    return JSON.parse(jsonBuffer.toString())
}

/**
 * Fetch the JSON metadata file for the given entityAddress using the given gateway
 * @param entityAddress 
 * @param gatewayInfo Data of the Vocdoni Gateway to fetch the data from
 */
export function getEntityMetadataByAddress(entityAddress: string, gatewayInfo: GatewayInfo): Promise<EntityMetadata> {
    if (!entityAddress) throw new Error("Invalid entityAddress")
    else if (!gatewayInfo || !(gatewayInfo instanceof GatewayInfo)) throw new Error("Invalid Gateway URI object")

    const entityId = getEntityId(entityAddress)
    return getEntityMetadata(entityId, gatewayInfo)
}

/**
 * Update the ENS fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
 * Throws an Error if the schema does not match
 * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
 * @return A content URI with the IPFS origin
 */
export async function updateEntity(entityAddress: string, entityMetadata: EntityMetadata,
    walletOrSigner: Wallet | Signer, gatewayInfo: GatewayInfo): Promise<string> {
    if (!entityAddress) throw new Error("Invalid entityAddress")
    else if (!entityMetadata) throw new Error("Invalid Entity metadata")

    // throw if not valid
    checkValidEntityMetadata(entityMetadata)
    const strJsonMeta = JSON.stringify(entityMetadata)

    const gw = new DVoteGateway(gatewayInfo)
    const web3 = new Web3Gateway(gatewayInfo)

    if (walletOrSigner instanceof Wallet && !walletOrSigner.provider) {
        walletOrSigner = walletOrSigner.connect(web3.getProvider())
    }

    await gw.connect()
    const ipfsUri = await addFile(strJsonMeta, "entity-metadata.json", walletOrSigner, gw)
    gw.disconnect()

    // Set the IPFS origin on the blockchain
    const resolverInstance = await getEntityResolverInstance({ provider: web3.getProvider(), signer: walletOrSigner })

    const entityId = getEntityId(entityAddress)
    const tx = await resolverInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

    // TODO: Unpin oldMetaContentUri

    await tx.wait()
    return ipfsUri
}
