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
    // TODO: Handle duplicates?
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

        // Create mapping of colocated web3/dvote services
        const gatewayPairs = mapWeb3DvoteGateways(bootnodeData[networkId], totalDvoteNodes, totalWeb3Nodes)

        if (!totalDvoteNodes.length)
            throw new Error(`The Dvote gateway list is empty of ${networkId}`)

        const healthyNodes = await filterHealthyNodes(totalDvoteNodes, totalWeb3Nodes, numberOfGateways, timeoutsToTest)
        if (!healthyNodes) throw new Error("Empty response after filterHealthyNodes")

        // Arrange, sort and check connectivity
        const gwNodePairs = arrangePairedNodes(healthyNodes.dvote, healthyNodes.web3, gatewayPairs)

        gwNodePairs.sort((a, b) => {
            if (!b && !a) return 0
            else if (!b) return 1
            else if (!a) return -1
            else if (!b.dvote && !a.dvote) return 0
            else if (!b.dvote) return 1
            else if (!a.dvote) return -1
            else if (isNaN(b.dvote.health) && isNaN(a.dvote.health)) return 0
            else if (isNaN(b.dvote.health)) return 1
            else if (isNaN(a.dvote.health)) return -1
            return b.dvote.weight - a.dvote.weight
        })

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
        console.error(err)

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

    // TODO: Clean console.logs
    console.error("Could not find any active gateways")
    console.error({ dvoteGateways, web3Gateways })

    throw new Error("No working gateways found out of " + discoveredDvoteNodes.length + " and " + discoveredWeb3Nodes.length)
}

function mapWeb3DvoteGateways(networkBootnodeData: JsonBootnodeData[EthNetworkID], dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[]) {
    let pairs: Map<IDVoteGateway, IWeb3Gateway> = new Map()
    for (let gateway of networkBootnodeData.dvote) {
        const dvoteIndex = networkBootnodeData.dvote.indexOf(gateway)
        // -1 if non existing
        const web3PairIndex = networkBootnodeData.web3.findIndex(web3 => parseURL(web3.uri).host === parseURL(gateway.uri).host)
        const web3Pair = (web3PairIndex > -1) ? web3Gateways[web3PairIndex] : undefined
        pairs.set(dvoteGateways[dvoteIndex], web3Pair)
    }
    return pairs
}

function arrangePairedNodes(dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[], gatewayPairs: Map<IDVoteGateway, IWeb3Gateway>): { dvote: IDVoteGateway, web3: IWeb3Gateway }[] {
    let gatewayList: { dvote: IDVoteGateway, web3: IWeb3Gateway }[] = []
    for (const gw of dvoteGateways) {
        const web3Paired = gatewayPairs.get(gw)
        if (web3Paired && web3Gateways.includes(web3Paired)) {
            gatewayList.push({ dvote: gw, web3: web3Paired })
        }
        else {
            const idx = Math.floor(Math.random() * web3Gateways.length)
            gatewayList.push({ dvote: gw, web3: web3Gateways[idx] })
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
                console.error("Health check failed:", dvoteGw.uri, error)
                // Skip adding tot the list
            })
        checks.push(prom)
    })

    web3Nodes.forEach(web3Gw => {
        let prom = web3Gw.isUp(timeout)
            .then(() => { result.web3.push(web3Gw) })
            .catch(error => {
                console.error("Health check failed:", web3Gw.provider["connection"].url, error)
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
