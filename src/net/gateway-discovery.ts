import { ContentUri } from "../wrappers/content-uri"
import { Gateway } from "./gateway"
import { IDVoteGateway } from "./gateway-dvote"
import { IWeb3Gateway } from "./gateway-web3"
import { EthNetworkID, GatewayBootnode } from "./gateway-bootnode"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { JsonBootnodeData } from "../models/gateway"
import { promiseFuncWithTimeout } from "../util/timeout"
import { Random } from "../util/random"
import { VocdoniEnvironment } from "../models/common"
import { GatewayDiscoveryError, GatewayDiscoveryValidationError } from "../util/errors/gateway-discovery"

export interface IGatewayDiscoveryParameters {
    networkId: EthNetworkID,
    environment?: VocdoniEnvironment
    bootnodesContentUri: string | ContentUri
    numberOfGateways?: number
    /** Timeout in milliseconds */
    timeout?: number
}

export class GatewayDiscovery {

    /**
     * Maximum number of GWs that will be tested parallel
     */
    public static PARALLEL_GATEWAY_TESTS: number = 5

    /**
     * Minimum number of GWs that need to succeed on a check round for it to be valid.
     * Otherwise, the next threshold rate will be attempted
     */
    public static MIN_ROUND_SUCCESS_COUNT: number = 2

    /**
     * Retrieve a **connected and live** gateway, choosing based on the info provided by the healthStatus of the Gateway
     *
     * @param params The gateway parameters for running the discovery process
     * @returns A Gateway array
     */
    public static run(params: IGatewayDiscoveryParameters): Promise<Gateway[]> {
        if (!params) {
            return Promise.reject(new GatewayDiscoveryValidationError())
        } else if (!params.networkId) {
            return Promise.reject(new GatewayDiscoveryValidationError(GatewayDiscoveryValidationError.INVALID_NETWORK_ID))
        } else if (params.environment && !["prod", "stg", "dev"].includes(params.environment)) {
            return Promise.reject(new GatewayDiscoveryValidationError(GatewayDiscoveryValidationError.INVALID_ENVIRONMENT))
        } else if (!params.bootnodesContentUri) {
            return Promise.reject(new GatewayDiscoveryValidationError(GatewayDiscoveryValidationError.INVALID_BOOTNODE_URI))
        } else if (params.numberOfGateways && !Number.isInteger(params.numberOfGateways)) {
            return Promise.reject(new GatewayDiscoveryValidationError(GatewayDiscoveryValidationError.INVALID_NUMBER_GATEWAYS))
        } else if (params.timeout && !Number.isInteger(params.timeout)) {
            return Promise.reject(new GatewayDiscoveryValidationError(GatewayDiscoveryValidationError.INVALID_TIMEOUT))
        }

        return this.getWorkingGateways(
                params.networkId,
                params.bootnodesContentUri,
                params.environment,
                params.numberOfGateways,
                params.timeout,
            )
            .then((gateways: Array<{dvote: IDVoteGateway, web3: IWeb3Gateway}>) => gateways.map(
                (gw: {dvote: IDVoteGateway, web3: IWeb3Gateway}) => new Gateway(gw.dvote, gw.web3)
            ))
            .catch((error: Error | GatewayDiscoveryError) => {
                if (error instanceof GatewayDiscoveryError) {
                    throw error
                }
                throw new GatewayDiscoveryError(GatewayDiscoveryError.NO_WORKING_GATEWAYS)
            })
    }

    /**
     * Implements the logic of the health check on the gateways in the following manner. There are two
     * basic rounds
     * 1. Check sets of gateways: The retrieved list of gateways is randomized and split in
     *    sets of $ParallelGatewayTests that are pararrely checked (respond in /ping and
     *     getInfo) with a time limit of $GATEWAY_SELECTION_TIMEOUT
     * 2. Repeat 1 wiht timeout backtracking: Currently simply using 2*$GATEWAY_SELECTION_TIMEOUT
     * @param networkId The Ethereum network to which the gateway should be associated
     * @param bootnodesContentUri (optional) The Content URI from which the list of gateways will be extracted
     * @param environment
     * @param numberOfGateways
     * @param timeout
     * @returns A Gateway Object
     */
    private static async getWorkingGateways(
        networkId: EthNetworkID,
        bootnodesContentUri: string | ContentUri,
        environment: VocdoniEnvironment = "prod",
        numberOfGateways: number = this.MIN_ROUND_SUCCESS_COUNT,
        timeout: number = GATEWAY_SELECTION_TIMEOUT,
    ): Promise<Array<{ dvote: IDVoteGateway, web3: IWeb3Gateway }>> {

        const timeoutsToTest = [timeout, 2 * timeout, 4 * timeout, 16 * timeout]
        let totalDvoteNodes: IDVoteGateway[]

        // Extract BootnodeData
        const bootnodeData: JsonBootnodeData = await promiseFuncWithTimeout(
            () => GatewayBootnode.getGatewaysFromUri(bootnodesContentUri),
            GATEWAY_SELECTION_TIMEOUT,
        ).catch(
            (_) => { throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_FETCH_ERROR) }
        )

        // Randomizing DvoteGateways order
        bootnodeData[networkId].dvote = Random.shuffle(bootnodeData[networkId].dvote)
        bootnodeData[networkId].web3 = Random.shuffle(bootnodeData[networkId].web3)

        // Instantiate gateways
        const bnGateways = GatewayBootnode.digestNetwork(bootnodeData, networkId, environment)
        totalDvoteNodes = bnGateways.dvote
        const totalWeb3Nodes: IWeb3Gateway[] = bnGateways.web3

        if (!totalDvoteNodes.length)
            throw new Error(`The Dvote gateway list is empty of ${networkId}`)

        const healthyNodes = await this.filterHealthyNodes(totalDvoteNodes, totalWeb3Nodes, numberOfGateways, timeoutsToTest)

        // Arrange, sort and check connectivity
        healthyNodes.dvote.sort((a: IDVoteGateway, b: IDVoteGateway) => {
            switch (!!a && !!b) {
                // Return the GW with more weight
                case a.weight !== b.weight:
                    return b.weight - a.weight
                // Else return the best performance time
                default:
                    return a.performanceTime - b.performanceTime
            }
        })

        const web3PeerCount = healthyNodes.web3.map((gw: IWeb3Gateway) => (gw.peerCount))

        const web3getBlockNumberCandidates: Array<Promise<void>> = healthyNodes.web3.filter((gw: IWeb3Gateway, index: number) => {
            return gw.peerCount === -1 || web3PeerCount.filter((v: number, i: number) => i !== index).includes(gw.peerCount)
        }).map((gw: IWeb3Gateway) => gw.getBlockNumber())

        if (web3getBlockNumberCandidates.length) {
            await Promise.allSettled(web3getBlockNumberCandidates).then()
        }

        healthyNodes.web3.sort((a: IWeb3Gateway, b: IWeb3Gateway) => {
            switch (!!a && !!b) {
                // Return the GW with more peers
                case a.peerCount !== b.peerCount:
                    return b.peerCount - a.peerCount
                // In case of same number of peers consider the difference of blocks (if higher than 3)
                case Math.abs(b.lastBlockNumber - a.lastBlockNumber) > 3:
                    return b.lastBlockNumber - a.lastBlockNumber
                // Last metric is the performance time
                default:
                    return a.performanceTime - b.performanceTime
            }
        })

        const gwNodePairs = this.createNodePairs(healthyNodes.dvote, healthyNodes.web3)
        // TODO Check at least one ENS for best GW and if not possible shift it to the end and move to the next one
        let hasInitialCandidate = false
        for (let gw of gwNodePairs) {
            // TODO this is always true
            if (gw.dvote.isReady) {
                hasInitialCandidate = true
                break
            }
        }
        if (!hasInitialCandidate) throw new GatewayDiscoveryError(GatewayDiscoveryError.NO_CANDIDATES_READY)

        return gwNodePairs
    }

    private static async filterHealthyNodes(
        discoveredDvoteNodes: IDVoteGateway[],
        discoveredWeb3Nodes: IWeb3Gateway[],
        numberOfGateways: number,
        timeoutsToTest: number[],
    ): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
        let dvoteGateways: IDVoteGateway[] = []
        let web3Gateways: IWeb3Gateway[] = []

        // forLoop implements the timeout rounds
        for (let timeout of timeoutsToTest) {
            // define which gateways are going to be used in this timeout round
            // i.e All the nodes except from the ones found working already

            let dvoteNodes = discoveredDvoteNodes.slice().filter(gw => !dvoteGateways.includes(gw))
            let web3Nodes = discoveredWeb3Nodes.slice().filter(gw => !web3Gateways.includes(gw))

            // define which gateways are going to be used in this Parallel test round
            // that is N  dvote and N web3 gateways with N=PARALLEL_GATEWAY_TESTS

            let testDvote = dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
            let testWeb3 = web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS)

            // whileLoop tests the gateways parallely by sets of $PARALLEL_GATEWAY_TESTS
            while (testDvote.length > 0 || testWeb3.length > 0) {
                const result = await this.selectActiveNodes(testDvote, testWeb3, timeout)

                dvoteGateways = dvoteGateways.concat(result.dvote)
                web3Gateways = web3Gateways.concat(result.web3)

                // next
                // TODO MIN_ROUND NOT PARALLEL
                testDvote = dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
                testWeb3 = web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
            }

            // Check to decide if we should proceed to the next timeout
            // If enough gateways collected then return
            if (dvoteGateways.length >= numberOfGateways && web3Gateways.length >= numberOfGateways) {
                // return arrangePairedNodes(dvoteGateways, web3Gateways, gatewayPairs, discoveredDvoteNodes, discoveredWeb3Nodes)
                return { dvote: dvoteGateways, web3: web3Gateways }
            }
        }

        // Less gateways than requested
        if (dvoteGateways.length && web3Gateways.length) return { dvote: dvoteGateways, web3: web3Gateways }

        throw new Error("No working gateways found out of " + discoveredDvoteNodes.length + " and " + discoveredWeb3Nodes.length)
    }

    /**
     * Helper functions that returns an array of dvote/web3 pairs merging the two input arrays in order
     */
    private static createNodePairs(dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[]): { dvote: IDVoteGateway, web3: IWeb3Gateway }[] {
        let length = (dvoteGateways.length > web3Gateways.length) ? dvoteGateways.length : web3Gateways.length
        let gatewayList: { dvote: IDVoteGateway, web3: IWeb3Gateway }[] = Array(length)
        for (let idx = 0; idx < gatewayList.length; idx++) {
            gatewayList[idx] = {
                web3: (idx < web3Gateways.length) ? web3Gateways[idx] : web3Gateways[Math.floor(Math.random() * web3Gateways.length)],
                dvote: (idx < dvoteGateways.length) ? dvoteGateways[idx] : dvoteGateways[Math.floor(Math.random() * dvoteGateways.length)]
            }
        }
        return gatewayList
    }

    /**
     * Implements the health check on the gateways pararrely checkig in /ping and
     * getInfo with a time limit of timeout.
     * Also the Web3Gateways are mapped to coresponding DvoteGateways in case the
     * should be chosen in a coupled manner
     * @param dvoteNodes The set of DvoteGateways to be checked
     * @param web3Nodes The set of available Web3Gateways
     * @returns A Gateway Object
     */
    private static selectActiveNodes(dvoteNodes: IDVoteGateway[], web3Nodes: IWeb3Gateway[], timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
        const result: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } = {
            dvote: [],
            web3: []
        }

        const checks: Promise<void>[] = []

        dvoteNodes.forEach((dvoteGw) => {
            let prom = dvoteGw.isUp(timeout)
                .then(() => { result.dvote.push(dvoteGw) })
                .catch(error => {
                    // console.error("Health check failed:", dvoteGw.uri, error)
                    // Skip adding tot the list
                })
            checks.push(prom)
        })

        web3Nodes.forEach(web3Gw => {
            let prom = web3Gw.isUp(timeout)
                .then(() => { result.web3.push(web3Gw) })
                .catch(error => {
                    // console.error("Health check failed:", web3Gw.provider["connection"].url, error)
                    // Skip adding tot the list
                })
            checks.push(prom)
        })

        return Promise.all(checks)
            .then(() => result)
            .catch(() => {
                return result
            })
    }
}
