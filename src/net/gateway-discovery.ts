import { ContentUri } from "../wrappers/content-uri"
import { IDVoteGateway } from "./gateway-dvote"
import { IWeb3Gateway } from "./gateway-web3"
import { EthNetworkID, GatewayBootnode } from "./gateway-bootnode"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { BackendApiName, GatewayApiName, JsonBootnodeData } from "../models/gateway"
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

export interface IGatewayActiveNodes {
    dvote: IDVoteGateway[],
    web3: IWeb3Gateway[],
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
     * Retrieve a **connected and live** gateway, choosing based on the info provided by the metrics of the Gateway
     *
     * @param params The gateway parameters for running the discovery process
     *
     * @returns A Gateway array
     */
    public static run(params: IGatewayDiscoveryParameters): Promise<IGatewayActiveNodes> {
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
            .then((gateways: IGatewayActiveNodes) => gateways)
            .catch((error: Error | GatewayDiscoveryError) => {
                if (error instanceof GatewayDiscoveryError) {
                    throw error
                }
                throw new GatewayDiscoveryError()
            })
    }

    /**
     * Returns a new random Gateway that is attached to the required network
     *
     * @param networkId Either "mainnet", "rinkeby" or "goerli" (test)
     * @param requiredApis A list of the required APIs
     * @param environment The Vocdoni environment that will be used
     */
    public static randomFromDefault(networkId: EthNetworkID,
                                    requiredApis: (GatewayApiName | BackendApiName)[] = [],
                                    environment: VocdoniEnvironment
    ): Promise<{ dvote: IDVoteGateway, web3: IWeb3Gateway }> {
        return GatewayBootnode.getDefaultUri(networkId, environment)
            .then((bootnodeUri: ContentUri) => {
                return this.getGatewaysFromBootnodeData(
                    networkId,
                    bootnodeUri,
                    environment,
                    1,
                    GATEWAY_SELECTION_TIMEOUT
                )
            })
            .then((gateways: IGatewayActiveNodes) => this.getFirstGateway(gateways))
    }

    /**
     * Returns a new random Gateway that is attached to the required network
     *
     * @param networkId Either "mainnet", "rinkeby" or "goerli" (test)
     * @param requiredApis A list of the required APIs
     * @param bootnodeUri The uri from which contains the available gateways
     * @param environment The Vocdoni environment that will be used
     */
    public static randomfromUri(networkId: EthNetworkID,
                                requiredApis: (GatewayApiName | BackendApiName)[] = [],
                                bootnodeUri: string | ContentUri,
                                environment: VocdoniEnvironment,
    ): Promise<{ dvote: IDVoteGateway, web3: IWeb3Gateway }> {
        return this.getGatewaysFromBootnodeData(
            networkId, bootnodeUri, environment, 1, GATEWAY_SELECTION_TIMEOUT
        )
        .then((gateways: IGatewayActiveNodes) => this.getFirstGateway(gateways))
    }

    /**
     * Returns the first available Gateway from the given list
     *
     * @param gateways The list of gateways to race
     */
    private static async getFirstGateway(gateways: IGatewayActiveNodes): Promise<{ dvote: IDVoteGateway, web3: IWeb3Gateway }> {
        // TODO: Filter by required API's
        const [web3, dvote] = await Promise.all([
            Promise.race(gateways.web3.map(w3 => w3.check().then(() => w3))),
            Promise.race(gateways.dvote.map(dv => dv.check().then(() => dv)))
        ])
        if (!web3) throw new Error("Could not find an active Web3 Gateway")
        else if (!dvote) throw new Error("Could not find an active DVote Gateway")

        return { dvote, web3 }
    }

    /**
     * Gets a list of DVote and Web3 Gateways from bootnode data, discards the not healthy gateways
     * and returns a ordered list of working DVote and Web3 Gateways by performance metrics
     *
     * @param networkId The Ethereum network to which the gateway should be associated
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @param environment (optional) The Vocdoni environment that will be used
     * @param minNumberOfGateways (optional) The minimum number of gateways needed
     * @param timeout (optional) The timeout for a gateway discovery process
     *
     * @returns A list of working and healthy pairs of DVote and Web3 Gateways
     */
    private static getWorkingGateways(
        networkId: EthNetworkID,
        bootnodesContentUri: string | ContentUri,
        environment: VocdoniEnvironment = "prod",
        minNumberOfGateways: number = this.MIN_NUMBER_GATEWAYS,
        timeout: number = GATEWAY_SELECTION_TIMEOUT,
    ): Promise<IGatewayActiveNodes> {

        // Get the gateways instances from bootnode data
        return this.getGatewaysFromBootnodeData(networkId, bootnodesContentUri, environment, minNumberOfGateways, timeout)
            .then((bootnodeGateways: IGatewayActiveNodes) => {
                // Discard unhealthy nodes
                return this.filterHealthyNodes(
                    bootnodeGateways.dvote,
                    bootnodeGateways.web3,
                    minNumberOfGateways,
                    [timeout, 2 * timeout, 4 * timeout, 16 * timeout],
                )
            })
            .then((healthyNodes: IGatewayActiveNodes) => {
                // Sort nodes
                return this.sortNodes(healthyNodes)
            })
    }

    /**
     * Gets the bootnodes data from the given URI and returns the gateway instances for the given network.
     *
     * @param networkId The Ethereum network to which the gateway should be associated
     * @param bootnodesContentUri The Content URI from which the list of gateways will be extracted
     * @param environment The Vocdoni environment that will be used
     * @param minNumberOfGateways The minimum number of gateways needed
     * @param timeout The timeout for a gateway discovery process
     *
     * @returns A list of DVote and Web3 Gateways instances
     */
    private static getGatewaysFromBootnodeData(
        networkId: EthNetworkID,
        bootnodesContentUri: string | ContentUri,
        environment: VocdoniEnvironment,
        minNumberOfGateways: number,
        timeout: number,
    ): Promise<IGatewayActiveNodes> {
        return promiseWithTimeout(
            // Extract BootnodeData
            GatewayBootnode.getGatewaysFromUri(bootnodesContentUri).catch(() => {
                throw new GatewayDiscoveryError(GatewayDiscoveryError.BOOTNODE_FETCH_ERROR)
            }),
            timeout,
            GatewayDiscoveryError.BOOTNODE_TIMEOUT_ERROR,
        )
        .then((bootnodeData: JsonBootnodeData) => {
            // Check if there are enough gateways
            if (bootnodeData[networkId].dvote.length < minNumberOfGateways) {
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
            return GatewayBootnode.digestNetwork(bootnodeData, networkId, environment)
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
     * @param minNumberOfGateways The minimum number of gateways needed
     * @param timeoutsToTest A list of timeouts to use for each discovery round
     *
     * @returns A list of working and healthy DVote and Web3 Gateways
     */
    private static async filterHealthyNodes(
        discoveredDvoteNodes: IDVoteGateway[],
        discoveredWeb3Nodes: IWeb3Gateway[],
        minNumberOfGateways: number,
        timeoutsToTest: number[],
    ): Promise<IGatewayActiveNodes> {
        let dvoteGateways: IDVoteGateway[] = []
        let web3Gateways: IWeb3Gateway[] = []

        // Loop all timeouts as a check round
        do {
            const timeout = timeoutsToTest.shift()
            let isDiscoveryRoundFinished = false

            // The gateways to check in this round are filtered here
            // We take those unchecked or those who timed out the round before
            const dvoteNodes = discoveredDvoteNodes.slice().filter(
                (gw: IDVoteGateway) => !dvoteGateways.includes(gw) && (gw.hasTimeOutLastRequest === undefined || gw.hasTimeOutLastRequest)
            )
            const web3Nodes = discoveredWeb3Nodes.slice().filter(
                (gw: IWeb3Gateway) => !web3Gateways.includes(gw) && (gw.hasTimeOutLastRequest === undefined || gw.hasTimeOutLastRequest)
            )

            // Launch the checking process for this round split by the maximum parallel requests defined
            do {
                const testDvote = dvoteGateways.length < minNumberOfGateways ? dvoteNodes.splice(0, this.PARALLEL_GATEWAY_TESTS) : []
                const testWeb3 = web3Gateways.length < minNumberOfGateways ? web3Nodes.splice(0, this.PARALLEL_GATEWAY_TESTS) : []

                // Until there are gateways to test, the check round is not finished
                if (testDvote.length !== 0 || testWeb3.length !== 0) {
                    await this.selectActiveNodes(testDvote, testWeb3, timeout).then((result: IGatewayActiveNodes) => {
                        dvoteGateways = dvoteGateways.concat(result.dvote)
                        web3Gateways = web3Gateways.concat(result.web3)

                        // If enough gateways collected then stop the process immediately
                        if (dvoteGateways.length >= minNumberOfGateways && web3Gateways.length >= minNumberOfGateways) {
                            isDiscoveryRoundFinished = true
                        }
                    })
                } else {
                    isDiscoveryRoundFinished = true
                }
            // Loop until the discovery round is finished
            } while (!isDiscoveryRoundFinished)

            // If enough gateways collected then return
            if (dvoteGateways.length >= minNumberOfGateways && web3Gateways.length >= minNumberOfGateways) {
                return { dvote: dvoteGateways, web3: web3Gateways }
            }
        } while (timeoutsToTest.length)

        throw new GatewayDiscoveryError()
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
                // Return the GW with best performance time
                case a.performanceTime !== b.performanceTime:
                    return a.performanceTime - b.performanceTime
                // Else return the GW with best health
                default:
                    return b.health - a.health
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
            const prom = dvoteGw.check(timeout)
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

        // TODO Promise.allSettled is the correct one, should be used when target = ES2020 is fixed
        return Promise.all(checks).then(() => activeNodes).catch(() => activeNodes)
        // return Promise.allSettled(checks).then(() => activeNodes).catch(() => activeNodes)
    }
}
