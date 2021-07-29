import { FileApi } from "../api/file";
import { ContentUri } from "../wrappers/content-uri"
import {
    VOCDONI_MAINNET_ENTITY_ID,VOCDONI_RINKEBY_ENTITY_ID, VOCDONI_GOERLI_ENTITY_ID, VOCDONI_XDAI_ENTITY_ID, VOCDONI_SOKOL_ENTITY_ID, XDAI_ENS_REGISTRY_ADDRESS, XDAI_PROVIDER_URI, XDAI_CHAIN_ID,
    SOKOL_CHAIN_ID, SOKOL_PROVIDER_URI, SOKOL_ENS_REGISTRY_ADDRESS, XDAI_STG_ENS_REGISTRY_ADDRESS, VOCDONI_XDAI_STG_ENTITY_ID
} from "../constants"
import { TextRecordKeys } from "../models/entity"
import { IGateway } from "./gateway";
import { DVoteGatewayResponseBody } from "./gateway-dvote";
import { IGatewayPool } from "./gateway-pool";
import { keccak256 } from "@ethersproject/keccak256"

export type EthNetworkID = "mainnet" | "rinkeby" | "goerli" | "xdai" | "sokol"

export class GatewayArchive {

    /**
     * Fetch the process data on the IPFS archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    public static getProcessFromArchive(processId: string, gateway: IGateway | IGatewayPool, errorMessage: string): Promise<DVoteGatewayResponseBody> {
        return this.getArchiveUri(gateway)
            .then((archiveUri: ContentUri) => {
                return this.getArchiveFile(archiveUri, processId, gateway)
            })
            .then((result: string) => {
                return JSON.parse(result)
            })
            .catch((error) => {
                throw new Error(errorMessage)
            })
    }

    /**
     * Gets the archive Uri from the given network id
     *
     * @param gateway
     */
    private static getArchiveUri(gateway: IGateway | IGatewayPool): Promise<ContentUri> {
        if (gateway.archiveUri) {
            return Promise.resolve(new ContentUri(gateway.archiveUri))
        }

        return gateway.getEnsPublicResolverInstance().then(async instance => {
            let entityEnsNode: string
            switch (await gateway.networkId) {
                case "mainnet":
                    entityEnsNode = keccak256(VOCDONI_MAINNET_ENTITY_ID)
                    break
                case "goerli":
                    entityEnsNode = keccak256(VOCDONI_GOERLI_ENTITY_ID)
                    break
                case "rinkeby":
                    entityEnsNode = keccak256(VOCDONI_RINKEBY_ENTITY_ID)
                    break
                case "xdai":
                    // if (environment === 'prod') {
                    //     entityEnsNode = keccak256(VOCDONI_XDAI_ENTITY_ID)
                    //     break
                    // }
                    entityEnsNode = keccak256(VOCDONI_XDAI_STG_ENTITY_ID)
                    break
                case "sokol":
                    entityEnsNode = keccak256(VOCDONI_SOKOL_ENTITY_ID)
                    break
            }
            return instance.text(entityEnsNode, TextRecordKeys.VOCDONI_ARCHIVE)
        }).then((uri: string) => {
            if (!uri) {
                throw new Error()
            }
            return new ContentUri(uri)
        })
    }

    /**
     * Gets the archive file from IPFS
     *
     * @param archiveUri
     * @param processId
     * @param gateway
     */
    private static getArchiveFile(archiveUri: ContentUri, processId: string, gateway: IGateway | IGatewayPool): Promise<string> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/" + processId.replace("0x", ""), gateway)
    }
}
