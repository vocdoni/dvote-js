import { Wallet, Signer, ContractTransaction } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { Gateway, IGateway } from "../net/gateway"
import { TextRecordKeys } from "../models/entity"
import { fetchFileString, addFile } from "./file"
import { IGatewayPool, GatewayPool } from "../net/gateway-pool"
import { XDAI_CHAIN_ID, XDAI_GAS_PRICE, SOKOL_CHAIN_ID, SOKOL_GAS_PRICE } from "../constants"
import { IMethodOverrides, ensHashAddress } from "../net/contracts"

/**
 * Asserts that the given object is a valid Entity JSON metadtata.
 * Throws an exception if it is not.
 */
export function checkValidMetadata(entityMetadata: EntityMetadata) {
    return checkValidEntityMetadata(entityMetadata)
}

/**
 * Fetch the JSON metadata file for the given entity ID using the given gateway instances
 * @param address
 * @param web3Gateway Web3Gateway instance already connected
 * @param dvoteGateway Gateway instance already connected to an active service
 */
export async function getEntityMetadata(address: string, gateway: Gateway | IGatewayPool): Promise<EntityMetadata> {
    if (!address) return Promise.reject(new Error("Invalid address"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    const resolverInstance = await gateway.getEnsPublicResolverInstance()

    const metadataContentUri = await resolverInstance.text(ensHashAddress(address), TextRecordKeys.JSON_METADATA_CONTENT_URI)
    if (!metadataContentUri) return Promise.reject(new Error("The given entity has no metadata defined yet"))

    const jsonBuffer = await fetchFileString(metadataContentUri, gateway)

    return JSON.parse(jsonBuffer.toString())
}

/**
 * Update the ENS Text fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
 * Throws an Error if the schema does not match
 * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
 * @return A content URI with the IPFS origin
 */
export async function setMetadata(address: string, metadata: EntityMetadata, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
    if (!address) return Promise.reject(new Error("Invalid address"))
    else if (!metadata) return Promise.reject(new Error("Invalid Entity metadata"))
    else if (!(gateway instanceof Gateway || gateway instanceof GatewayPool)) return Promise.reject(new Error("Invalid Gateway object"))

    // throw if not valid
    checkValidEntityMetadata(metadata)
    const strJsonMeta = JSON.stringify(metadata)

    if (walletOrSigner instanceof Wallet && !walletOrSigner.provider) {
        walletOrSigner = walletOrSigner.connect(gateway.provider)
    }

    const ipfsUri = await addFile(strJsonMeta, "entity-metadata.json", walletOrSigner, gateway)

    // Set the IPFS origin on the blockchain
    const resolverInstance = await gateway.getEnsPublicResolverInstance(walletOrSigner)

    const entityAddrHash = ensHashAddress(address)
    const chainId = await gateway.chainId
    let options: IMethodOverrides
    let tx: ContractTransaction
    switch (chainId) {
        case XDAI_CHAIN_ID:
            options = { gasPrice: XDAI_GAS_PRICE }
            tx = await resolverInstance.setText(entityAddrHash, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri, options)
            break
        case SOKOL_CHAIN_ID:
            const addr = await walletOrSigner.getAddress()
            const nonce = await walletOrSigner.provider.getTransactionCount(addr)
            options = {
                gasPrice: SOKOL_GAS_PRICE,
                nonce,
            }
            tx = await resolverInstance.setText(entityAddrHash, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri, options)
            break
        default:
            tx = await resolverInstance.setText(entityAddrHash, TextRecordKeys.JSON_METADATA_CONTENT_URI, ipfsUri)

    }

    // TODO: Unpin oldMetaContentUri

    await tx.wait()
    return ipfsUri
}
