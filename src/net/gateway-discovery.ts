import { ContentUri } from "../wrappers/content-uri"
// import GatewayInfo from "../wrappers/gateway-info"
import { Gateway } from "./gateway"
import { IDVoteGateway } from "./gateway-dvote"
import { IWeb3Gateway } from "./gateway-web3"
import { EthNetworkID, GatewayBootnode } from "./gateway-bootnode"
import { parseURL } from 'universal-parse-url'
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { JsonBootnodeData } from "../models/gateway"
import { promiseFuncWithTimeout, promiseWithTimeout } from "../util/timeout"
import { Random } from "../util/random"
import { VocdoniEnvironment } from "../models/common"


const PARALLEL_GATEWAY_TESTS = 5

// Minimum number of GW's that need to succeed on a check round for it to be valid.
// Otherwise, the next threshold rate will be attempted
const MIN_ROUND_SUCCESS_COUNT = 2

export type IGatewayDiscoveryParameters = {
    networkId: EthNetworkID,
    environment?: VocdoniEnvironment
    bootnodesContentUri: string | ContentUri
    numberOfGateways?: number
    /** Timeout in milliseconds */
    timeout?: number
}

export class GatewayDiscovery {
    /**
     * Retrieve a **connected and live** gateway, choosing based on the info provided by the healthStatus of the Gateway
     * @returns A Gateway array
     */
    static run(params: IGatewayDiscoveryParameters): Promise<Gateway[]> {
        if (!params) return Promise.reject(new Error("Invalid parameters"))
        else if (!params.networkId)
            return Promise.reject(new Error("Invalid parameters. No networkId provided"))
        else if (!params.environment) return Promise.reject(new Error("Invalid environment provided"))
        else if (!params.bootnodesContentUri)
            return Promise.reject(new Error("Empty bootnodesContentUri"))
        else if (params.numberOfGateways && !Number.isInteger(params.numberOfGateways))
            return Promise.reject(new Error("Invalid numberOfGateways"))
        else if (params.timeout && !Number.isInteger(params.timeout))
            return Promise.reject(new Error("Invalid timeout"))

        return getWorkingGateways(params)
            .then(gateways => gateways.map(gw => new Gateway(gw.dvote, gw.web3)))
            .catch(error => {
                throw new Error(error && error.message || "Unable to find a working gateway")
            })
    }
}

///////////////////////////////////////////////////////////////////////////////
// INTERNAL
///////////////////////////////////////////////////////////////////////////////

/**
 * Implements the logic of the health check on the gateways in the following manner. There are two
 * basic rounds
 * 1. Check sets of gateways: The retrieved list of gateways is randomized and split in
 *    sets of $ParallelGatewayTests that are pararrely checked (respond in /ping and
 *     getInfo) with a time limit of $GATEWAY_SELECTION_TIMEOUT
 * 2. Repeat 1 wiht timeout backtracking: Currently simply using 2*$GATEWAY_SELECTION_TIMEOUT
 * @param networkId The Ethereum network to which the gateway should be associated
 * @param bootnodesContentUri (optional) The Content URI from which the list of gateways will be extracted
 * @returns A Gateway Object
 */
async function getWorkingGateways(params: IGatewayDiscoveryParameters): Promise<{ dvote: IDVoteGateway, web3: IWeb3Gateway }[]> {
    const networkId = params.networkId
    const bootnodesContentUri = (params.bootnodesContentUri) ? params.bootnodesContentUri : null
    const numberOfGateways = (params.numberOfGateways) ? params.numberOfGateways : MIN_ROUND_SUCCESS_COUNT
    const timeout = (params.timeout) ? params.timeout : GATEWAY_SELECTION_TIMEOUT
    const environment: VocdoniEnvironment = params.environment ? params.environment : "prod"

    const timeoutsToTest = [timeout, 2 * timeout, 4 * timeout, 16 * timeout]
    let totalDvoteNodes: IDVoteGateway[]

    try {
        // Extract BootnodeData
        const bootnodeData: JsonBootnodeData = await promiseFuncWithTimeout(() => {
            if (bootnodesContentUri) return GatewayBootnode.getGatewaysFromUri(bootnodesContentUri)
            return GatewayBootnode.getDefaultGateways(networkId)
        }, GATEWAY_SELECTION_TIMEOUT
        ).catch(err => { throw new Error("Could not fetch the bootnode details") })

        // Randomizing DvoteGateways order
        bootnodeData[networkId].dvote = Random.shuffle(bootnodeData[networkId].dvote)
        bootnodeData[networkId].web3 = Random.shuffle(bootnodeData[networkId].web3)

        // Instantiate gateways
        const bnGateways = GatewayBootnode.digestNetwork(bootnodeData, networkId, environment)
        totalDvoteNodes = bnGateways.dvote
        const totalWeb3Nodes: IWeb3Gateway[] = bnGateways.web3

        if (!totalDvoteNodes.length)
            throw new Error(`The Dvote gateway list is empty of ${networkId}`)

        const healthyNodes = await filterHealthyNodes(totalDvoteNodes, totalWeb3Nodes, numberOfGateways, timeoutsToTest)
        if (!healthyNodes) throw new Error("Empty response after filterHealthyNodes")

        // Arrange, sort and check connectivity
        healthyNodes.dvote.sort((a, b) => {
            if (!b && !a) return 0
            else if (!b) return 1
            else if (!a) return -1
            else if (!b && !a) return 0
            else if (!b) return 1
            else if (!a) return -1
            else if (isNaN(b.health) && isNaN(a.health)) return 0
            else if (isNaN(b.health)) return 1
            else if (isNaN(a.health)) return -1
            return b.weight - a.weight
        })

        healthyNodes.web3.sort((a, b) => {
            if (!b && !a) return 0
            else if (!b) return 1
            else if (!a) return -1
            else if (!b && !a) return 0
            else if (!b) return 1
            else if (!a) return -1
            else if (isNaN(b.peerCount) && isNaN(a.peerCount)) return 0
            else if (isNaN(b.peerCount)) return 1
            else if (isNaN(a.peerCount)) return -1
            // in case of equal peercount consider diference of blocks (if higher than 3)
            else if (a.peerCount == b.peerCount && (Math.abs(b.lastBlockNumber - a.lastBlockNumber) > 3)) return b.lastBlockNumber - a.lastBlockNumber
            return b.peerCount - a.peerCount
        })

        const gwNodePairs = createNodePairs(healthyNodes.dvote, healthyNodes.web3)
        let hasInitialCandidate = false
        for (let gw of gwNodePairs) {
            if (gw.dvote.isReady) {
                hasInitialCandidate = true
                break
            }
        }
        if (!hasInitialCandidate) throw new Error("None of the candidates is ready")

        return gwNodePairs
    }
    catch (err) {
        if (err.message == "Could not fetch the bootnode details") throw err
        else if (err.message == "None of the candidates is ready") throw err
        throw new Error("No working gateway found")
    }
}

async function filterHealthyNodes(discoveredDvoteNodes: IDVoteGateway[], discoveredWeb3Nodes: IWeb3Gateway[], numberOfGateways: number, timeoutsToTest: number[]): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
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

        let testDvote = dvoteNodes.splice(0, PARALLEL_GATEWAY_TESTS)
        let testWeb3 = web3Nodes.splice(0, PARALLEL_GATEWAY_TESTS)

        // whileLoop tests the gateways parallely by sets of $PARALLEL_GATEWAY_TESTS
        while (testDvote.length > 0 || testWeb3.length > 0) {
            const result = await selectActiveNodes(testDvote, testWeb3, timeout)

            dvoteGateways = dvoteGateways.concat(result.dvote)
            web3Gateways = web3Gateways.concat(result.web3)

            // next
            testDvote = dvoteNodes.splice(0, PARALLEL_GATEWAY_TESTS)
            testWeb3 = web3Nodes.splice(0, PARALLEL_GATEWAY_TESTS)
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
function createNodePairs(dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[]): { dvote: IDVoteGateway, web3: IWeb3Gateway }[] {
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
function selectActiveNodes(dvoteNodes: IDVoteGateway[], web3Nodes: IWeb3Gateway[], timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
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
