import { Wallet, Signer, ContractTransaction } from "ethers"
import { checkValidEntityMetadata, EntityMetadata } from "../models/entity"
import { Gateway, IGateway } from "../net/gateway"
import { TextRecordKeys } from "../models/entity"
import { allSettled } from "../util/promise";
import { FileApi } from "./file"
import { IGatewayPool, GatewayPool } from "../net/gateway-pool"
import { XDAI_CHAIN_ID, XDAI_GAS_PRICE, SOKOL_CHAIN_ID, SOKOL_GAS_PRICE } from "../constants"
import { IMethodOverrides, ensHashAddress, ITokenStorageProofContract } from "../net/contracts"
import { CensusErc20Api } from "./census"

export class EntityApi {
    /**
     * Fetch the JSON metadata file for the given entity ID using the given gateway instances
     * @param address
     * @param gateway Gateway or Gateway pool instance
     */
    static async getMetadata(address: string, gateway: Gateway | IGatewayPool): Promise<EntityMetadata> {
        if (!address) return Promise.reject(new Error("Invalid address"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        const resolverInstance = await gateway.getEnsPublicResolverInstance()

        const metadataContentUri = await resolverInstance.text(ensHashAddress(address), TextRecordKeys.JSON_METADATA_CONTENT_URI)
        if (!metadataContentUri) return Promise.reject(new Error("The given entity has no metadata defined yet"))

        const jsonData = await FileApi.fetchString(metadataContentUri, gateway)

        return JSON.parse(jsonData)
    }

    /**
     * Update the ENS Text fields on the blockchain and upload the corresponding JSON metadata file to IPFS using a Gateway
     * Throws an Error if the schema does not match
     * NOTE: The JSON metadata may need a few minutes before it can be generally fetched from IPFS
     * @return A content URI with the IPFS origin
     */
    static async setMetadata(address: string, metadata: EntityMetadata, walletOrSigner: Wallet | Signer, gateway: IGateway | IGatewayPool): Promise<string> {
        if (!address) return Promise.reject(new Error("Invalid address"))
        else if (!metadata) return Promise.reject(new Error("Invalid Entity metadata"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        // throw if not valid
        checkValidEntityMetadata(metadata)
        const strJsonMeta = JSON.stringify(metadata)

        if (walletOrSigner._isSigner && !walletOrSigner.provider) {
            walletOrSigner = walletOrSigner.connect(gateway.provider)
        }

        const ipfsUri = await FileApi.add(strJsonMeta, "entity-metadata.json", walletOrSigner, gateway)

        // Set the IPFS origin on the blockchain
        const resolverInstance = await gateway.getEnsPublicResolverInstance(walletOrSigner)

        const entityAddrHash = ensHashAddress(address)
        const chainId = await gateway.chainId
        let options: IMethodOverrides
        let tx: ContractTransaction
        switch (chainId) {
            case XDAI_CHAIN_ID:
                let gasPrice = XDAI_GAS_PRICE
                try {
                    gasPrice = await walletOrSigner.provider.getGasPrice()
                } catch (error) {
                    console.log("Could not estimate gas price with 'getGasPrice, using default value: '", gasPrice.toString())
                }
                options = { gasPrice }
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
}

export class Erc20TokensApi {
    /**
     * Retrieve the addresses of all the ERC20 tokens registered on the contract.
     * @param gateway Gateway or GatewayPool instance
     */
    static async getTokenList(gateway: Gateway | IGatewayPool): Promise<string[]> {
        let tokenInstance: ITokenStorageProofContract
        return gateway.getTokenStorageProofInstance()
            .then(instance => {
                tokenInstance = instance

                return tokenInstance.tokenCount()
            }).then(count => {
                const indexes = new Array(count).fill(0).map((_, i) => i)

                // TODO Promise.allSettled is the correct one, should be used when target = ES2020 is fixed
                return allSettled(indexes.map(idx => CensusErc20Api.getTokenAddressAt(idx, gateway)))
            }).then((results: Array<{"value": any, "status": string}>) => {
                return results.map((result: {"value": any, "status": string}) => result.value)
            })
    }
}
