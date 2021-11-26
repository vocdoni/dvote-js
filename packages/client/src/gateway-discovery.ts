import { ContentUri } from "./wrappers/content-uri"
import { Gateway } from "./gateway"
import { DVoteGateway } from "./gateway-dvote"
import { Web3Gateway } from "./gateway-web3"
import { GatewayBootnode } from "./gateway-bootnode"
import { JsonBootnodeData } from "./apis/definition"
import {
    allSettled,
    EthNetworkID,
    GATEWAY_SELECTION_TIMEOUT,
    promiseWithTimeout,
    Random,
    VocdoniEnvironment
} from "@vocdoni/common"
import { GatewayDiscoveryError, GatewayDiscoveryValidationError } from "./errors/discovery"
import { IGatewayDiscoveryParameters } from "./interfaces"

interface IGatewayActiveNodes {
    dvote: DVoteGateway[],
    web3: Web3Gateway[],
}

interface IGateway {
    dvote: DVoteGateway,
    web3: Web3Gateway,
}

export class GatewayDiscovery {

    /**
     * Maximum number of GWs that will be tested parallel
     */
    public static PARALLEL_GATEWAY_TESTS: number = 2

    /**
     * Minimum number of GWs that need to succeed on a check round for considering the discovery process finished.
     * Otherwise, the next round will be done in order to achieve the desired number
     */
    public static MIN_NUMBER_GATEWAYS: number = 1

    /**
     *  Parameters provided by the user
     */
    public static networkId: EthNetworkID
    public static environment: VocdoniEnvironment
    public static bootnodesContentUri: string | ContentUri
    public static minNumberOfGateways: number
    public static timeout: number
    public static resolveEnsDomains: boolean
    public static archiveIpnsId: string

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
        this.networkId = params.networkId
        this.environment = params.environment || "prod"
        this.bootnodesContentUri = params.bootnodesContentUri
        this.minNumberOfGateways = params.numberOfGateways || this.MIN_NUMBER_GATEWAYS
        this.timeout = params.timeout || GATEWAY_SELECTION_TIMEOUT
        this.resolveEnsDomains = params.resolveEnsDomains || false
        this.archiveIpnsId = params.archiveIpnsId

        return this.getWorkingGateways()
            .then((gateways: IGateway[]) => gateways.map(
                    (gw: IGateway) => new Gateway(gw.dvote, gw.web3)
                )
            )
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
     * @returns A list of working and healthy pairs of DVote and Web3 Gateways
     */
    private static getWorkingGateways(): Promise<IGateway[]> {

        // Get the gateways instances from bootnode data
        return this.getGatewaysFromBootnodeData()
            .then((bootnodeGateways: IGatewayActiveNodes) => {
                // Discard unhealthy nodes
                return this.filterHealthyNodes(
                    bootnodeGateways.dvote,
                    bootnodeGateways.web3,
                    [this.timeout, 2 * this.timeout, 4 * this.timeout, 16 * this.timeout],
                )
            })
            .then((healthyNodes: IGatewayActiveNodes) => {
                // Sort nodes
                const sortedNodes = this.sortNodes(healthyNodes)

                // Set the archive IPNS Id if given
                if (this.archiveIpnsId) {
                    sortedNodes.web3.forEach((web3Gateway: Web3Gateway) => web3Gateway.archiveIpnsId = this.archiveIpnsId)
                }

                // Create pairs of DVote and Web3 gateways
                return this.createNodePairs(sortedNodes.dvote, sortedNodes.web3)
            })
    }

    /**
     * Gets the bootnodes data from the given URI and returns the gateway instances for the given network.
     *
     * @returns A list of DVote and Web3 Gateways instances
     */
    private static getGatewaysFromBootnodeData(): Promise<IGatewayActiveNodes> {
        const networkId = this.networkId
        const prom = GatewayBootnode.getGatewaysFromUri(this.bootnodesContentUri)
            .catch(() => {
                throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_FETCH_ERROR)
            })

        return promiseWithTimeout(prom, this.timeout, GatewayDiscoveryError.BOOTNODE_TIMEOUT_ERROR)
            .then((bootnodeData: JsonBootnodeData) => {
                // Check if there are enough gateways
                if (bootnodeData[networkId].dvote.length < this.minNumberOfGateways) {
                    throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_NOT_ENOUGH_GATEWAYS)
                }

                // Removing duplicates
                bootnodeData[networkId].dvote = bootnodeData[networkId].dvote.filter(
                    (v, i, a) => a.findIndex((t) => (t.uri === v.uri)) === i
                )
                bootnodeData[networkId].web3 = bootnodeData[networkId].web3.filter(
                    (v, i, a) => a.findIndex((t) => (t.uri === v.uri)) === i
                )

                // Randomizing Gateways order
                bootnodeData[networkId].dvote = Random.shuffle(bootnodeData[networkId].dvote)
                bootnodeData[networkId].web3 = Random.shuffle(bootnodeData[networkId].web3)

                // Return the instances
                return GatewayBootnode.digestNetwork(bootnodeData, networkId, this.environment)
            })
    }

    /**
     * Implements the logic of the health check on the gateways in the following manner.
     * There are two basic rounds:
     *
     * 1. Check sets of gateways: The retrieved list of gateways is split in
     *    sets of $ParallelGatewayTests that are parallel checked with a given timeout
     * 2. Repeat with next timeout if not enough Gateways are found
     *
     * @param discoveredDvoteNodes The discovered DVote Gateway instances from bootnode data
     * @param discoveredWeb3Nodes The discovered Web3 Gateway instances from bootnode data
     * @param timeoutsToTest A list of timeouts to use for each discovery round
     *
     * @returns A list of working and healthy DVote and Web3 Gateways
     */
    private static async filterHealthyNodes(
        discoveredDvoteNodes: DVoteGateway[],
        discoveredWeb3Nodes: Web3Gateway[],
        timeoutsToTest: number[],
    ): Promise<IGatewayActiveNodes> {
        const minNumberOfGateways = this.minNumberOfGateways
        let dvoteGateways: DVoteGateway[] = []
        let web3Gateways: Web3Gateway[] = []

        // Loop all timeouts as a check round
        do {
            const timeout = timeoutsToTest.shift()

            // The gateways to check in this round are filtered here
            // We take those unchecked or those who timed out the round before
            const dvoteNodes = discoveredDvoteNodes.filter(
                (gw: DVoteGateway) => !dvoteGateways.includes(gw) && (gw.hasTimeOutLastRequest === undefined || gw.hasTimeOutLastRequest)
            )
            const web3Nodes = discoveredWeb3Nodes.filter(
                (gw: Web3Gateway) => !web3Gateways.includes(gw) && (gw.hasTimeOutLastRequest === undefined || gw.hasTimeOutLastRequest)
            )

            let testDvote: DVoteGateway[]
            let testWeb3: Web3Gateway[]

            // Launch the checking process for this round split by the maximum parallel requests defined
            do {
                testDvote = dvoteGateways.length < minNumberOfGateways ? dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS) : []
                testWeb3 = web3Gateways.length < minNumberOfGateways ? web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS) : []

                // Until there are gateways to test, the check round is not finished
                await this.selectActiveNodes(testDvote, testWeb3, timeout).then((result: IGatewayActiveNodes) => {
                    dvoteGateways = dvoteGateways.concat(result.dvote)
                    web3Gateways = web3Gateways.concat(result.web3)
                })
            } while (
                (testDvote.length !== 0 || testWeb3.length !== 0) &&
                (dvoteGateways.length < minNumberOfGateways || web3Gateways.length < minNumberOfGateways)
            ) // Loop until the discovery round is finished

            // If enough gateways collected then return
            if (dvoteGateways.length >= minNumberOfGateways && web3Gateways.length >= minNumberOfGateways) {
                return { dvote: dvoteGateways, web3: web3Gateways }
            }
        } while (timeoutsToTest.length)

        throw new GatewayDiscoveryError()
    }

    /**
     * Helper functions that returns an array of dvote/web3 pairs merging the two input arrays in order
     */
    // TODO: @marcvelmer remove this function when refactoring pool
    private static createNodePairs(dvoteGateways: DVoteGateway[], web3Gateways: Web3Gateway[]): { dvote: DVoteGateway, web3: Web3Gateway }[] {
        let length = (dvoteGateways.length > web3Gateways.length) ? dvoteGateways.length : web3Gateways.length
        let gatewayList: { dvote: DVoteGateway, web3: Web3Gateway }[] = Array(length)
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
        // Sort DVote gateways by weight
        healthyNodes.dvote.sort((a: DVoteGateway, b: DVoteGateway) => {
            return (!!a && !!b) ? b.weight - a.weight : 0
        })

        // Get the block numbers frequency and select the most frequent if there is any
        let mostFrequentBlockNumber: number
        const blockNumbersByFrequency = Object.entries(
            healthyNodes.web3.map((gw: Web3Gateway) => (gw.lastBlockNumber)).reduce((prev, cur: number) => {
                prev[cur] = prev[cur] ? prev[cur] + 1 : 1;
                return prev;
            }, {})
        )
        if (blockNumbersByFrequency.length !== healthyNodes.web3.length) {
            mostFrequentBlockNumber = +blockNumbersByFrequency.reduce((prev, cur) => (cur[1] >= prev[1] ? cur : prev), [null, 0])[0];
        }

        // Sort the Web3 Gateways by metrics
        healthyNodes.web3.sort((a: Web3Gateway, b: Web3Gateway) => {
            switch (!!a && !!b) {
                // Return the gateway which last block number is the most frequent
                case Number.isInteger(mostFrequentBlockNumber) && Math.abs(mostFrequentBlockNumber - a.lastBlockNumber) !== Math.abs(mostFrequentBlockNumber - b.lastBlockNumber):
                    return Math.abs(mostFrequentBlockNumber - b.lastBlockNumber) === 0 ? 1 : -1
                // Last metric is the weight
                default:
                    return b.weight - a.weight
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
    private static selectActiveNodes(dvoteNodes: DVoteGateway[], web3Nodes: Web3Gateway[], timeout: number): Promise<IGatewayActiveNodes> {
        const activeNodes: IGatewayActiveNodes = {
            dvote: [],
            web3: [],
        }
        const checks: Array<Promise<void>> = []

        dvoteNodes.forEach((dvoteGw: DVoteGateway) => {
            const prom = dvoteGw.checkStatus(timeout)
                .then(() => { activeNodes.dvote.push(dvoteGw) })
            checks.push(prom)
        })

        web3Nodes.forEach((web3Gw: Web3Gateway) => {
            const prom = web3Gw.checkStatus(timeout, this.resolveEnsDomains)
                .then(() => {
                    // Skip adding to the list if there is no address resolved
                    if (this.resolveEnsDomains && !web3Gw.ensPublicResolverContractAddress) {
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

        // TODO Promise.allSettled is the correct one, should be used when target = ES2020 is fixed
        return allSettled(checks).then(() => activeNodes)
    }
}
