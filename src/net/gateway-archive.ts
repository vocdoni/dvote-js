import { FileApi } from "../api/file";
import { TextRecordKeys } from "../models/entity"
import { getEnsPublicResolverByNetwork } from "../util/ens";
import { ContentUri } from "../wrappers/content-uri"
import { EthNetworkID, IGatewayClient, IGatewayDVoteClient } from "../common";

export interface IArchiveResponseBody {
    process?: {
        [k: string]: any
    }
    results?: {
        [k: string]: any
    },
}

export namespace GatewayArchive {

    /**
     * Fetch the process data on the IPFS archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getProcess(processId: string, gateway: IGatewayClient, errorMessage: string): Promise<IArchiveResponseBody> {
        return resolveArchiveUri(gateway, errorMessage)
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
     * @param errorMessage
     */
    async function resolveArchiveUri(gateway: IGatewayClient, errorMessage: string): Promise<ContentUri> {
        if (gateway.archiveIpnsId) {
            return Promise.resolve(new ContentUri(gateway.archiveIpnsId))
        }

        const networkId = await gateway.networkId as EthNetworkID

        return getEnsPublicResolverByNetwork(gateway, { environment: gateway.environment, networkId })
            .then(ens => ens.instance.text(ens.entityEnsNode, TextRecordKeys.VOCDONI_ARCHIVE))
            .then((uri: string) => {
                if (!uri) {
                    throw new Error(errorMessage)
                }
                gateway.archiveIpnsId = uri
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
    function getArchiveFile(archiveUri: ContentUri, processId: string, gateway: IGatewayDVoteClient): Promise<string> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/" + processId.replace("0x", ""), gateway)
    }
}
