import { FileApi } from "../api/file";
import { TextRecordKeys } from "../models/entity"
import { getEnsPublicResolverByNetwork } from "../util/ens";
import { ContentUri } from "../wrappers/content-uri"
import { IGateway } from "./gateway";
import { DVoteGatewayResponseBody } from "./gateway-dvote";
import { IGatewayPool } from "./gateway-pool";

export type EthNetworkID = "homestead" | "mainnet" | "rinkeby" | "goerli" | "xdai" | "sokol"

export namespace GatewayArchive {

    /**
     * Fetch the process data on the IPFS archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getProcess(processId: string, gateway: IGateway | IGatewayPool, errorMessage: string): Promise<DVoteGatewayResponseBody> {
        return resolveArchiveUri(gateway)
            .then((archiveUri: ContentUri) => {
                return getArchiveFile(archiveUri, processId, gateway)
            })
            .then((result: string) => JSON.parse(result))
            .catch((error) => {
                throw new Error(errorMessage)
            })
    }

    /**
     * Resolves the archive Uri from the given network id
     *
     * @param gateway
     */
    async function resolveArchiveUri(gateway: IGateway | IGatewayPool): Promise<ContentUri> {
        if (gateway.getArchiveUri()) {
            return Promise.resolve(new ContentUri(gateway.getArchiveUri()))
        }

        const networkId = await gateway.networkId as EthNetworkID

        return getEnsPublicResolverByNetwork(gateway, { environment: gateway.getEnvironment(), networkId })
            .then(ens => ens.instance.text(ens.entityEnsNode, TextRecordKeys.VOCDONI_ARCHIVE))
            .then((uri: string) => {
                if (!uri) {
                    throw new Error()
                }
                gateway.setArchiveUri(uri)
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
    function getArchiveFile(archiveUri: ContentUri, processId: string, gateway: IGateway | IGatewayPool): Promise<string> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/" + processId.replace("0x", ""), gateway)
    }
}
