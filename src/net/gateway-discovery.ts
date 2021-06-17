import { ContentUri } from "../wrappers/content-uri"
import { Gateway } from "./gateway"
import { IDVoteGateway } from "./gateway-dvote"
import { IWeb3Gateway } from "./gateway-web3"
import { EthNetworkID, GatewayBootnode } from "./gateway-bootnode"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { JsonBootnodeData } from "../models/gateway"
import { promiseWithTimeout } from "../util/timeout"
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

interface IGatewayActiveNodes {
    dvote: IDVoteGateway[],
    web3: IWeb3Gateway[],
}

interface IGateway {
    dvote: IDVoteGateway,
    web3: IWeb3Gateway,
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
     * Retrieve a **connected and live** gateway, choosing based on the info provided by the metrics of the Gateway
     *
     * @param params The gateway parameters for running the discovery process
     *
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
            .then((gateways: IGateway[]) => gateways.map(
                (gw: IGateway) => new Gateway(gw.dvote, gw.web3)
            ))
            .catch((error: Error | GatewayDiscoveryError) => {
                if (error instanceof GatewayDiscoveryError) {
                    throw error
                }
                throw new GatewayDiscoveryError()
            })
    }

    /**
     * Gets a list of DVote and Web3 Gateways from bootnode data, discards the not healthy gateways
     * and returns a ordered list of working DVote and Web3 Gateways by performance metrics
     *
     * @param networkId The Ethereum network to which the gateway should be associated
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @param environment (optional) The Vocdoni environment that will be used
     * @param numberOfGateways (optional) The minimum number of gateways needed
     * @param timeout (optional) The timeout for a gateway discovery process
     *
     * @returns A list of working and healthy pairs of DVote and Web3 Gateways
     */
    private static async getWorkingGateways(
        networkId: EthNetworkID,
        bootnodesContentUri: string | ContentUri,
        environment: VocdoniEnvironment = "prod",
        numberOfGateways: number = this.MIN_ROUND_SUCCESS_COUNT,
        timeout: number = GATEWAY_SELECTION_TIMEOUT,
    ): Promise<IGateway[]> {

        // Get the gateways instances from bootnode data
        return this.getGatewaysFromBootnodeData(networkId, bootnodesContentUri, environment, numberOfGateways, timeout)
            .then((bootnodeGateways: IGatewayActiveNodes) => {
                // Discard unhealthy nodes
                return this.filterHealthyNodes(
                    bootnodeGateways.dvote,
                    bootnodeGateways.web3,
                    numberOfGateways,
                    [timeout, 2 * timeout, 4 * timeout, 16 * timeout],
                )
            })
            .then((healthyNodes: IGatewayActiveNodes) => {
                // Sort nodes
                const sortedNodes = this.sortNodes(healthyNodes)

                // Create pairs of DVote and Web3 gateways
                return this.createNodePairs(sortedNodes.dvote, sortedNodes.web3)
            })
    }

    /**
     * Gets the bootnodes data from the given URI and returns the gateway instances for the given network.
     *
     * @param networkId The Ethereum network to which the gateway should be associated
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @param environment The Vocdoni environment that will be used
     * @param numberOfGateways The minimum number of gateways needed
     * @param timeout The timeout for a gateway discovery process
     *
     * @returns A list of DVote and Web3 Gateways instances
     */
    private static async getGatewaysFromBootnodeData(
        networkId: EthNetworkID,
        bootnodesContentUri: string | ContentUri,
        environment: VocdoniEnvironment,
        numberOfGateways: number,
        timeout: number,
    ): Promise<IGatewayActiveNodes> {

        return await promiseWithTimeout(
            // Extract BootnodeData
            GatewayBootnode.getGatewaysFromUri(bootnodesContentUri).catch(() => {
                throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_FETCH_ERROR)
            }),
            timeout,
            GatewayDiscoveryError.BOOTNODE_TIMEOUT_ERROR,
        )
        .then((bootnodeData: JsonBootnodeData) => {
            // Check if there are enough gateways
            if (bootnodeData[networkId].dvote.length < numberOfGateways) {
                throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_NOT_ENOUGH_GATEWAYS)
            }

            // Randomizing Gateways order
            bootnodeData[networkId].dvote = Random.shuffle(bootnodeData[networkId].dvote)
            bootnodeData[networkId].web3 = Random.shuffle(bootnodeData[networkId].web3)

            // Return the instances
            return GatewayBootnode.digestNetwork(bootnodeData, networkId, environment)
        })
    }

    /**
     * Implements the logic of the health check on the gateways in the following manner. There are two
     * basic rounds
     * 1. Check sets of gateways: The retrieved list of gateways is split in
     *    sets of $ParallelGatewayTests that are parallel checked with a given timeout
     * 2. Repeat with next timeout if not enough Gateways are found
     *
     * @param discoveredDvoteNodes The discovered DVote Gateway instances from bootnode data
     * @param discoveredWeb3Nodes The discovered Web3 Gateway instances from bootnode data
     * @param numberOfGateways The minimum number of gateways needed
     * @param timeoutsToTest A list of timeouts to use for each discovery round
     *
     * @returns A list of working and healthy DVote and Web3 Gateways
     */
    private static async filterHealthyNodes(
        discoveredDvoteNodes: IDVoteGateway[],
        discoveredWeb3Nodes: IWeb3Gateway[],
        numberOfGateways: number,
        timeoutsToTest: number[],
    ): Promise<IGatewayActiveNodes> {
        let dvoteGateways: IDVoteGateway[] = []
        let web3Gateways: IWeb3Gateway[] = []

        // forLoop implements the timeout rounds
        // TODO next timeout is used even if GWs are discarded because of another reason
        for (const timeout of timeoutsToTest) {
            // define which gateways are going to be used in this timeout round
            // i.e All the nodes except from the ones found working already

            const dvoteNodes = discoveredDvoteNodes.slice().filter(gw => !dvoteGateways.includes(gw))
            const web3Nodes = discoveredWeb3Nodes.slice().filter(gw => !web3Gateways.includes(gw))

            // define which gateways are going to be used in this Parallel test round
            // that is N  dvote and N web3 gateways with N=PARALLEL_GATEWAY_TESTS

            let testDvote = dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
            let testWeb3 = web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS)

            // whileLoop tests the gateways parallely by sets of $PARALLEL_GATEWAY_TESTS
            while (testDvote.length > 0 || testWeb3.length > 0) {
                await this.selectActiveNodes(testDvote, testWeb3, timeout).then((result: IGatewayActiveNodes) => {
                    dvoteGateways = dvoteGateways.concat(result.dvote)
                    web3Gateways = web3Gateways.concat(result.web3)

                    // next
                    testDvote = dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
                    testWeb3 = web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS)
                })
            }

            // Check to decide if we should proceed to the next timeout
            // If enough gateways collected then return
            if (dvoteGateways.length >= numberOfGateways && web3Gateways.length >= numberOfGateways) {
                return { dvote: dvoteGateways, web3: web3Gateways }
            }
        }

        // Less gateways than requested
        // TODO should not throw an error?
        if (dvoteGateways.length && web3Gateways.length && false) {
            return { dvote: dvoteGateways, web3: web3Gateways }
        }

        throw new GatewayDiscoveryError()
    }

    /**
     * Helper functions that returns an array of dvote/web3 pairs merging the two input arrays in order
     */
    // TODO remove this function when refactoring pool
    private static createNodePairs(dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[]): { dvote: IDVoteGateway, web3: IWeb3Gateway }[] {
        let length = (dvoteGateways.length > web3Gateways.length) ? dvoteGateways.length : web3Gateways.length
        let gatewayList: { dvote: IDVoteGateway, web3: IWeb3Gateway }[] = Array(length)
        for (let idx = 0; idx < gatewayList.length; idx++) {
            gatewayList[idx] = {
                web3: (idx < web3Gateways.length) ? web3Gateways[idx] : web3Gateways[Math.floor(Math.random() * web3Gateways.length)],
                dvote: (idx < dvoteGateways.length) ? dvoteGateways[idx] : dvoteGateways[Math.floor(Math.random() * dvoteGateways.length)]
            }
        }

        let hasInitialCandidate = false
        for (let gw of gatewayList) {
            if (gw.dvote.isReady) {
                hasInitialCandidate = true
                break
            }
        }
        if (!hasInitialCandidate) throw new GatewayDiscoveryError(GatewayDiscoveryError.NO_CANDIDATES_READY)

        return gatewayList
    }

    /**
     * Sorts the given nodes list based on different metrics for DVote Gateways and Web3 Gateways
     *
     * @param healthyNodes A list of DVote and Web3 Gateways
     *
     * @returns A list of sorted DVote and Web3 Gateways
     */
    private static sortNodes(healthyNodes: IGatewayActiveNodes): IGatewayActiveNodes {
        // Sort DVote gateways by metrics
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

        // Get the block numbers frequency and select the most frequent if there is any
        let mostFrequentBlockNumber: number
        const blockNumbersByFrequency = Object.entries(
            healthyNodes.web3.map((gw: IWeb3Gateway) => (gw.lastBlockNumber)).reduce((a, v: number) => {
                a[v] = a[v] ? a[v] + 1 : 1;
                return a;
            }, {})
        )
        if (blockNumbersByFrequency.length !== healthyNodes.web3.length) {
            mostFrequentBlockNumber = +blockNumbersByFrequency.reduce((a, v) => (v[1] >= a[1] ? v : a), [null, 0])[0];
        }

        // Sort the Web3 Gateways by metrics
        healthyNodes.web3.sort((a: IWeb3Gateway, b: IWeb3Gateway) => {
            switch (!!a && !!b) {
                // Return the gateway which last block number is the most frequent
                case Number.isInteger(mostFrequentBlockNumber) && Math.abs(mostFrequentBlockNumber - a.lastBlockNumber) !== Math.abs(mostFrequentBlockNumber - b.lastBlockNumber):
                    return Math.abs(mostFrequentBlockNumber - b.lastBlockNumber) === 0 ? 1 : -1
                // Last metric is the performance time
                default:
                    return a.performanceTime - b.performanceTime
            }
        })

        return healthyNodes
    }

    /**
     * Implements the health check round for each set of DVote and Web3 gateways and discards those that
     * are not active or healthy
     *
     * @param dvoteNodes The set of DvoteGateways to be checked
     * @param web3Nodes The set of Web3Gateways to be checked
     * @param timeout The timeout for each Gateway test
     *
     * @returns A list of active and healthy DVote and Web3 Gateways
     */
    private static selectActiveNodes(dvoteNodes: IDVoteGateway[], web3Nodes: IWeb3Gateway[], timeout: number): Promise<IGatewayActiveNodes> {
        const activeNodes: IGatewayActiveNodes = {
            dvote: [],
            web3: [],
        }
        const checks: Array<Promise<void>> = []

        dvoteNodes.forEach((dvoteGw: IDVoteGateway) => {
            const prom = dvoteGw.isUp(timeout)
                .then(() => { activeNodes.dvote.push(dvoteGw) })
            checks.push(prom)
        })

        web3Nodes.forEach((web3Gw: IWeb3Gateway) => {
            const prom = web3Gw.check(timeout)
                .then(() => {
                    // Skip adding to the list if there is no address resolved
                    if (!web3Gw.ensPublicResolverContractAddress) {
                        return
                    }
                    // Skip adding to the list if peer count is not enough
                    else if (Number.isInteger(web3Gw.peerCount) && web3Gw.peerCount !== -1 && web3Gw.peerCount < 5) {
                        return
                    }
                    // Add to the list otherwise (no reasons to be discarded)
                    else {
                        activeNodes.web3.push(web3Gw)
                    }
                })
            checks.push(prom)
        })

        return Promise.all(checks).then(() => activeNodes).catch(() => activeNodes)
    }
}
