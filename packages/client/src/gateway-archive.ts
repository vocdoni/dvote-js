import { FileApi } from "./apis/file"
import { GatewayArchiveError } from "./errors/archive"
import { TextRecordKeys, strip0x } from "@vocdoni/common"
import { VochainProcessStatus } from "@vocdoni/data-models"
import { getEnsTextRecord } from "./net/ens"
import { ContentUri } from "./wrappers/content-uri"
import { EthNetworkID } from "@vocdoni/common"
import { IArchiveResponseBody, IGatewayClient, IGatewayDVoteClient } from "./interfaces"

export namespace GatewayArchive {

    /**
     * Returns the mapped data from archive to `getProcessSummary` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetProcessSummary(processArchiveData: IArchiveResponseBody) {
        processArchiveData.process.envelopeHeight = processArchiveData.results.envelopeHeight
        if (!processArchiveData.process.metadata) delete processArchiveData.process.metadata
        return {
            processSummary: processArchiveData.process
        }
    }

    /**
     * Returns the mapped data from archive to `getResultsWeight` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetResultsWeight(processArchiveData: IArchiveResponseBody) {
        return {
            weight: processArchiveData.results.weight
        }
    }

    /**
     * Returns the mapped data from archive to `getEnvelopeHeight` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetEnvelopeHeight(processArchiveData: IArchiveResponseBody) {
        return {
            height: processArchiveData.results.envelopeHeight
        }
    }

    /**
     * Returns the mapped data from archive to `getResults` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetResults(processArchiveData: IArchiveResponseBody) {
        return {
            results: processArchiveData.results.votes,
            state: VochainProcessStatus[processArchiveData.process.status] || "",
            height: processArchiveData.results.envelopeHeight,
        }
    }
}

export namespace GatewayArchiveApi {

    /**
     * Fetch the process data on the IPFS archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getProcess(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return resolveArchiveUri(gateway, errorMessage)
            .then((archiveUri: ContentUri) => {
                return fetchArchivedProcess(archiveUri, processId, gateway)
            })
            .catch((error) => {
                throw new GatewayArchiveError(errorMessage)
            })
    }

    /**
     * Resolves the archive Uri from the given network id
     *
     * @param gateway
     * @param errorMessage
     */
    function resolveArchiveUri(gateway: IGatewayClient, errorMessage: string): Promise<ContentUri> {
        if (gateway.archiveIpnsId) {
            return Promise.resolve(new ContentUri(gateway.archiveIpnsId))
        }

        return gateway.getEthNetworkId()
            .then(networkId => getEnsTextRecord(gateway, TextRecordKeys.VOCDONI_ARCHIVE, { environment: gateway.environment, networkId: networkId as EthNetworkID }))
            .then((uri: string) => {
                if (!uri) {
                    throw new GatewayArchiveError(errorMessage)
                }
                gateway.archiveIpnsId = uri
                return new ContentUri(uri)
            })
    }

    /**
     * Fetch the archive file from IPFS
     *
     * @param archiveUri
     * @param processId
     * @param gateway
     */
    function fetchArchivedProcess(archiveUri: ContentUri, processId: string, gateway: IGatewayDVoteClient): Promise<IArchiveResponseBody> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/" + strip0x(processId), gateway)
            .then((result: string) => JSON.parse(result))
    }
}
