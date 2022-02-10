import { FileApi } from "./apis/file"
import { GatewayArchiveError } from "./errors/archive"
import { TextRecordKeys, strip0x } from "@vocdoni/common"
import { VochainProcessStatus } from "@vocdoni/data-models"
import { getEnsTextRecord } from "./net/ens"
import { ContentUri } from "./wrappers/content-uri"
import { EthNetworkID } from "@vocdoni/common"
import {
    IArchiveEntitiesResponseBody,
    IArchiveProcessResponseBody,
    IGatewayClient,
    IGatewayDVoteClient
} from "./interfaces"

export namespace GatewayArchive {

    /**
     * Returns the mapped data from archive to `getProcess` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetProcess(processArchiveData: IArchiveProcessResponseBody) {
        processArchiveData.process.archived = true
        processArchiveData.process.startDate = processArchiveData.startDate ? new Date(processArchiveData.startDate) : null
        processArchiveData.process.endDate = processArchiveData.endDate ? new Date(processArchiveData.endDate) : null
        return processArchiveData
    }

    /**
     * Returns the mapped data from archive to `getProcessSummary` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetProcessSummary(processArchiveData: IArchiveProcessResponseBody) {
        processArchiveData.process.envelopeHeight = processArchiveData.results.envelopeHeight
        processArchiveData.process.archived = true
        processArchiveData.process.startDate = processArchiveData.startDate ? new Date(processArchiveData.startDate) : null
        processArchiveData.process.endDate = processArchiveData.endDate ? new Date(processArchiveData.endDate) : null
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
    export function mapToGetResultsWeight(processArchiveData: IArchiveProcessResponseBody) {
        return {
            weight: processArchiveData.results.weight
        }
    }

    /**
     * Returns the mapped data from archive to `getEnvelopeHeight` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetEnvelopeHeight(processArchiveData: IArchiveProcessResponseBody) {
        return {
            height: processArchiveData.results.envelopeHeight
        }
    }

    /**
     * Returns the mapped data from archive to `getResults` Gateway response
     *
     * @param processArchiveData
     */
    export function mapToGetResults(processArchiveData: IArchiveProcessResponseBody) {
        return {
            results: processArchiveData.results.votes,
            state: VochainProcessStatus[processArchiveData.process.status] || "",
            height: processArchiveData.results.envelopeHeight,
        }
    }

    /**
     * Returns the mapped data from archive to `getResults` Gateway response
     *
     * @param entityId
     * @param entitiesArchiveData
     */
    export function mapToGetProcessList(entitiesArchiveData: IArchiveEntitiesResponseBody, entityId?: string): string[] {
        if (entityId) {
            return entitiesArchiveData.entities[entityId]?.map(processId => processId.processId) ?? []
        }
        return Object.values(entitiesArchiveData.entities)
            .reduce((prev, curr) => prev.concat(curr), [])
            .map(processId => processId.processId)
    }
}

export namespace GatewayArchiveApi {

    /**
     * Fetch the process data from the IPFS archive
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
     * Fetch the entities data with processes from the IPFS archive
     *
     * @param gateway
     */
    export function getEntities(gateway: IGatewayClient) {
        return resolveArchiveUri(gateway)
            .then((archiveUri: ContentUri) => {
                return fetchArchivedIndex(archiveUri, gateway)
            })
            .catch((error) => {
                throw new GatewayArchiveError()
            })
    }

    /**
     * Resolves the archive Uri from the given network id
     *
     * @param gateway
     * @param errorMessage
     */
    function resolveArchiveUri(gateway: IGatewayClient, errorMessage?: string): Promise<ContentUri> {
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
     * Fetch the archived file from IPFS
     *
     * @param archiveUri
     * @param processId
     * @param gateway
     */
    function fetchArchivedProcess(archiveUri: ContentUri, processId: string, gateway: IGatewayDVoteClient): Promise<IArchiveProcessResponseBody> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/" + strip0x(processId), gateway)
            .then((result: string) => JSON.parse(result))
    }

    /**
     * Fetch the archived index from IPFS
     *
     * @param archiveUri
     * @param gateway
     */
    function fetchArchivedIndex(archiveUri: ContentUri, gateway: IGatewayDVoteClient): Promise<IArchiveEntitiesResponseBody> {
        return FileApi.fetchString("ipfs:///ipns/" + archiveUri + "/index.json", gateway)
            .then((result: string) => JSON.parse(result))

    }
}
