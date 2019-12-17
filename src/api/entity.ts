import { utils, Wallet, Signer } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { DVoteGateway, Web3Gateway, IDVoteGateway, IWeb3Gateway } from "../net/gateway"
import { getEntityResolverInstance } from "../net/contracts"
import { TextRecordKeys } from "../models/entity"
import { fetchFileString, addFile } from "./file"

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
 * @param dboteGateway DVoteGateway instance already connected to an active service
 */
export async function getEntityMetadata(entityId: string, web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<EntityMetadata> {
    if (!entityId) throw new Error("Invalid entityAddress")
    else if (!(web3Gateway instanceof Web3Gateway) || !(dvoteGateway instanceof DVoteGateway)) throw new Error("Invalid Gateway object")

    const resolverInstance = await getEntityResolverInstance({ provider: web3Gateway.getProvider() })

    const metadataContentUri = await resolverInstance.text(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI)
    if (!metadataContentUri) throw new Error("The given entity has no metadata defined yet")

    const jsonBuffer = await fetchFileString(metadataContentUri, dvoteGateway)

    return JSON.parse(jsonBuffer.toString())
}

/**
 * Fetch the JSON metadata file for the given entity address using the given gateway instances
 * @param entityAddress 
 * @param web3Gateway Web3Gateway instance already connected
 * @param dboteGateway DVoteGateway instance already connected to an active service
 */
export function getEntityMetadataByAddress(entityAddress: string, web3Gateway: IWeb3Gateway, dvoteGateway: IDVoteGateway): Promise<EntityMetadata> {
    if (!entityAddress) throw new Error("Invalid entityAddress")

    const entityId = getEntityId(entityAddress)
    return getEntityMetadata(entityId, web3Gateway, dvoteGateway)
}

/**
 * Update the ENS fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
 * Throws an Error if the schema does not match
 * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
 * @return A content URI with the IPFS origin
 */
export async function updateEntity(entityAddress: string, entityMetadata: EntityMetadata,
    walletOrSigner: Wallet | Signer, web3Gateway: IWeb3Gateway, dvoteGw: IDVoteGateway): Promise<string> {
    if (!entityAddress) throw new Error("Invalid entityAddress")
    else if (!entityMetadata) throw new Error("Invalid Entity metadata")

    // throw if not valid
    checkValidEntityMetadata(entityMetadata)
    const strJsonMeta = JSON.stringify(entityMetadata)

    if (walletOrSigner instanceof Wallet && !walletOrSigner.provider) {
        walletOrSigner = walletOrSigner.connect(web3Gateway.getProvider())
    }

    const ipfsUri = await addFile(strJsonMeta, "entity-metadata.json", walletOrSigner, dvoteGw)

    // Set the IPFS origin on the blockchain
    const resolverInstance = await getEntityResolverInstance({ provider: web3Gateway.getProvider(), signer: walletOrSigner })

    const entityId = getEntityId(entityAddress)
    const tx = await resolverInstance.setText(entityId, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

    // TODO: Unpin oldMetaContentUri

    await tx.wait()
    return ipfsUri
}
