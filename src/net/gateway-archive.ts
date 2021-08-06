import { FileApi } from "../api/file";
import { GatewayArchiveError } from "../errors/gateway-archive";
import { TextRecordKeys } from "../models/entity"
import { VochainProcessStatus } from "../models/protobuf";
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
     * Fetch the full state of the given processId on the process archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getProcessStateArchive(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return getProcess(processId, gateway, errorMessage)
    }

    /**
     * Fetch the headers of the given processId on the archive.
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getProcessSummaryArchive(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return getProcess(processId, gateway, errorMessage)
            .then((response) => {
                response.process.envelopeHeight = response.results.envelopeHeight
                return {
                    processSummary: response.process
                }
            })
    }

    /**
     * Retrieves the archive cumulative weight that has been casted in votes for the given process ID.
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getResultsWeightArchive(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return getProcess(processId, gateway, errorMessage)
            .then((response) => {
                return {
                    weight: response.results.weight
                }
            })
    }

    /**
     * Fetches the archive number of vote envelopes for a given processId
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    export function getEnvelopeHeightArchive(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return getProcess(processId, gateway, errorMessage)
            .then((response) => {
                return {
                    height: response.results.envelopeHeight
                }
            })
    }

    /**
     * Fetches the archive results for a given processId
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     * @returns Results, vote process  type, vote process state
     */
    export function getRawResultsArchive(processId: string, gateway: IGatewayClient, errorMessage: string) {
        return getProcess(processId, gateway, errorMessage)
            .then((response) => {
                return {
                    results: response.results.votes,
                    state: VochainProcessStatus[response.process.status as string] || "",
                    height: response.results.envelopeHeight,
                }
            })
    }

    /**
     * Fetch the process data on the IPFS archive
     *
     * @param processId
     * @param gateway
     * @param errorMessage
     */
    function getProcess(processId: string, gateway: IGatewayClient, errorMessage: string): Promise<IArchiveResponseBody> {
        return resolveArchiveUri(gateway, errorMessage)
            .then((archiveUri: ContentUri) => {
                return getArchiveFile(archiveUri, processId, gateway)
            })
            .then((result: string) => JSON.parse(result))
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
    async function resolveArchiveUri(gateway: IGatewayClient, errorMessage: string): Promise<ContentUri> {
        if (gateway.archiveIpnsId) {
            return Promise.resolve(new ContentUri(gateway.archiveIpnsId))
        }

        const networkId = await gateway.networkId as EthNetworkID

        return getEnsPublicResolverByNetwork(gateway, { environment: gateway.environment, networkId })
            .then(ens => ens.instance.text(ens.entityEnsNode, TextRecordKeys.VOCDONI_ARCHIVE))
            .then((uri: string) => {
                if (!uri) {
                    throw new GatewayArchiveError(errorMessage)
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
