import ContentURI from "../wrappers/content-uri"
// import GatewayInfo from "../wrappers/gateway-info"
import { IDVoteGateway, IWeb3Gateway, Gateway } from "./gateway"
import { fetchFromBootNode, fetchDefaultBootNode, getGatewaysFromBootNodeData, NetworkID } from "./gateway-bootnodes"
import { parseURL } from 'universal-parse-url'
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { GatewayBootNodes } from "../models/gateway"


const PARALLEL_GATEWAY_TESTS = 5

// Minimum number of GW's that need to succeed on a check round for it to be valid.
// Otherwise, the next threshold rate will be attempted
const MIN_ROUND_SUCCESS_COUNT = 2

export type GatewayDiscoveryParameters = {
    networkId: NetworkID,
    bootnodesContentUri?: string | ContentURI
    numberOfGateways?: number
    race?: boolean
    timeout?: number
}

/**
 * Retrieve a list of curently active gateways for the given entityAddress
 */
// export function getActiveEntityGateways(entityAddress: string): Promise<Gateway[]> {
//     throw new Error("TODO: unimplemented") // TODO: getActiveEntityGateways()
// }

/**
 * (wrapper of getWorkingGateways)
 * Retrieve a **connected and live** gateway, choosing based on the info provided by the healthStatus of the Gateway
 * @param networkId The Ethereum network to which the gateway should be associated
 * @param bootnodesContentUri (optional) The Content URI from which the list of gateways will be extracted
 * @returns A Gateway Object
 */
// export function discoverGateways(networkId: NetworkID, bootnodesContentUri?: string | ContentURI, walletOrSigner?: Wallet | Signer,
// params: DiscoveryParameters = { numberOfGateways: 1, timeout: GATEWAY_SELECTION_TIMEOUT, race: false }): Promise<Gateway[]> {
export function discoverGateways(params: GatewayDiscoveryParameters): Promise<Gateway[]> {
    if (!params) return Promise.reject(new Error("Invalid parameters"))
    else if (!params.networkId)
        return Promise.reject(new Error("Invalid parameters. No networkId provided"))
    // if (params.bootnodesContentUri && !((typeof params.bootnodesContentUri) in [String,ContentURI]) )
    else if (params.numberOfGateways && !Number.isInteger(params.numberOfGateways))
        return Promise.reject(new Error("Invalid parameters"))
    else if (params.timeout && !Number.isInteger(params.timeout))
        return Promise.reject(new Error("Invalid parameters"))

    return getWorkingGateways(params)
        .then(async gateways => {
            gateways.sort((a, b) => {
                if (!b && !a) return 0
                else if (!b) return 1
                else if (!a) return -1
                else if (!b.dvote && !a.dvote) return 0
                else if (!b.dvote) return 1
                else if (!a.dvote) return -1
                else if (isNaN(b.dvote.health) && isNaN(a.dvote.health)) return 0
                else if (isNaN(b.dvote.health)) return 1
                else if (isNaN(a.dvote.health)) return -1
                return b.dvote.health - a.dvote.health
            })

            let candidate: { dvote: IDVoteGateway, web3: IWeb3Gateway }
            for (let gw of gateways) {
                if (await gw.dvote.isConnected()) {
                    candidate = gw
                    break
                }
            }
            if (!candidate) throw new Error("No candidate gateway is connected after being selected")

            // Disconnect other gateways
            gateways.filter(gw => gw != candidate).map(gw => gw.dvote.disconnect())

            return gateways.map(gw => new Gateway(gw.dvote, gw.web3))
        })
        .catch(error => {
            throw new Error(error && error.message || "Unable to find a working gateway")
        })
}

/**
 * Implements the logic of the health check on the gateways in the following manner. There are two
 * basic rounds
 * 1. Check sets of gateways: The retrieved list of gateways is randomized and split in
 *    sets of $ParallelGatewayTests that are pararrely checked (respond in /ping and
 *     getGatewayInfo) with a time limit of $GATEWAY_SELECTION_TIMEOUT
 * 2. Repeat 1 wiht timeout backtracking: Currently simply using 2*$GATEWAY_SELECTION_TIMEOUT
 * @param networkId The Ethereum network to which the gateway should be associated
 * @param bootnodesContentUri (optional) The Content URI from which the list of gateways will be extracted
 * @returns A Gateway Object
 */
async function getWorkingGateways(p: GatewayDiscoveryParameters): Promise<{ dvote: IDVoteGateway, web3: IWeb3Gateway }[]> {
    // TODO: Handle duplicates?
    const networkId = p.networkId
    const bootnodesContentUri = (p.bootnodesContentUri) ? p.bootnodesContentUri : null
    const numberOfGateways = (p.numberOfGateways) ? p.numberOfGateways : MIN_ROUND_SUCCESS_COUNT
    const race = (p.race) ? p.race : false
    const timeout = (p.timeout) ? p.timeout : GATEWAY_SELECTION_TIMEOUT

    const timeoutsToTest = [timeout, 2 * timeout, 4 * timeout, 16 * timeout]

    // Extract BootnodeData
    const bootnodeData: GatewayBootNodes = await new Promise<GatewayBootNodes>((resolve, reject) => {
        setTimeout(() => reject(new Error("The request timed out")), GATEWAY_SELECTION_TIMEOUT / 2)

        if (bootnodesContentUri) return fetchFromBootNode(bootnodesContentUri).then(res => resolve(res))
        else return fetchDefaultBootNode(networkId).then(res => resolve(res))
    }).catch(err => { throw new Error("Could not fetch the bootnode details") })

    // Randomizing DvoteGateways order
    bootnodeData[networkId].dvote = shuffle(bootnodeData[networkId].dvote)
    bootnodeData[networkId].web3 = shuffle(bootnodeData[networkId].web3)

    // Instantiate gateways
    const defaultGateways = getGatewaysFromBootNodeData(bootnodeData)
    const totalDvoteNodes: IDVoteGateway[] = defaultGateways[networkId].dvote
    const totalWeb3Nodes: IWeb3Gateway[] = defaultGateways[networkId].web3

    // Create mapping of colocated web3/dvote services
    const gatewayPairs = mapWeb3DvoteGateways(bootnodeData[networkId], totalDvoteNodes, totalWeb3Nodes)

    if (!totalDvoteNodes.length)
        Promise.reject(new Error(`The Dvote gateway list is empty of ${networkId}`))

    return testingLoop(totalDvoteNodes, totalWeb3Nodes, numberOfGateways, race, timeoutsToTest)
        .then(result => {
            if (!result) throw new Error("Empty response after testingLoop")
            return generateResults(result.dvote, result.web3, gatewayPairs)
        })
        .catch(error => {
            console.error("testingLoop", error)
            throw new Error('No working gateway found')
        })
}

async function testingLoop(totalDvoteNodes: IDVoteGateway[], totalWeb3Nodes: IWeb3Gateway[], numberOfGateways: number, race: boolean, timeoutsToTest: number[]): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
    let dvoteGateways: IDVoteGateway[] = []
    let web3Gateways: IWeb3Gateway[] = []

    // forLoop implements the timeout rounds
    for (let timeout of timeoutsToTest) {
        // define which gateways are going to be used in this timeout round
        // i.e All the nodes except from the ones found working already

        let dvoteNodes = totalDvoteNodes.slice().filter(gw => !dvoteGateways.includes(gw))
        let web3Nodes = totalWeb3Nodes.slice().filter(gw => !web3Gateways.includes(gw))

        // define which gateways are going to be used in this Parallel test round
        // that is N  dvote and N web3 gateways with N=PARALLEL_GATEWAY_TESTS

        let testDvote = dvoteNodes.splice(0, PARALLEL_GATEWAY_TESTS)
        let testWeb3 = web3Nodes.splice(0, PARALLEL_GATEWAY_TESTS)

        // whileLoop tests the gateways parallely by sets of $PARALLEL_GATEWAY_TESTS
        while (testDvote.length > 0 || testWeb3.length > 0) {
            let result: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] }
            if (!race) result = await testGateways(testDvote, testWeb3, timeout)
            else result = await raceGateways(testDvote, testWeb3, timeout)

            dvoteGateways = dvoteGateways.concat(result.dvote)
            web3Gateways = web3Gateways.concat(result.web3)
            if (race && dvoteGateways.length > 0 && web3Gateways.length > 0) {
                console.log("Done racing gateways", { dvoteGateways, web3Gateways })
                return { dvote: dvoteGateways, web3: web3Gateways }
            }

            testDvote = dvoteNodes.splice(0, PARALLEL_GATEWAY_TESTS)
            testWeb3 = web3Nodes.splice(0, PARALLEL_GATEWAY_TESTS)
        }

        // Check to decide if we should proceed to the next timeout
        // If enough gateways collected then return
        if (dvoteGateways.length >= numberOfGateways && web3Gateways.length >= numberOfGateways) {
            // return generateResults(dvoteGateways, web3Gateways, gatewayPairs, totalDvoteNodes, totalWeb3Nodes)
            console.log("Done discovering gateways", { dvote: dvoteGateways, web3: web3Gateways })
            return { dvote: dvoteGateways, web3: web3Gateways }
        }
    }

    // Less gateways than requested
    if (dvoteGateways.length && web3Gateways.length) return { dvote: dvoteGateways, web3: web3Gateways }
    else if (race) {
        // retry without the race mode
        return testingLoop(totalDvoteNodes, totalWeb3Nodes, numberOfGateways, false, timeoutsToTest)
    }

    // TODO: Clean console.logs
    console.error("Could not find any active gateways")
    console.error({ dvoteGateways, web3Gateways })

    throw new Error("No working gateways found out of " + totalDvoteNodes.length + " and " + totalWeb3Nodes.length)
}

function mapWeb3DvoteGateways(networkBootnodeData: GatewayBootNodes[NetworkID], dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[]) {
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

function generateResults(dvoteGateways: IDVoteGateway[], web3Gateways: IWeb3Gateway[], gatewayPairs: Map<IDVoteGateway, IWeb3Gateway>): { dvote: IDVoteGateway, web3: IWeb3Gateway }[] {
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
 * getGatewayInfo with a time limit of timeout.
 * Also the Web3Gateways are mapped to coresponding DvoteGateways in case the
 * should be chosen in a coupled manner
 * @param dvoteNodes The set of DvoteGateways to be checked
 * @param web3Nodes The set of available Web3Gateways
 * @returns A Gateway Object
 */
function testGateways(dvoteNodes: IDVoteGateway[], web3Nodes: IWeb3Gateway[], timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
    const result: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } = {
        dvote: [],
        web3: []
    }

    const checks: Promise<void>[] = []

    dvoteNodes.forEach((dvoteGw) => {
        let prom = dvoteGw.isUp(timeout)
            .then(() => { result.dvote.push(dvoteGw) })
            .catch(error => {
                console.error("Is up failed:", error)
            })
        checks.push(prom)
    })

    web3Nodes.forEach(web3Gw => {
        let prom = web3Gw.isUp(timeout)
            .then(() => { result.web3.push(web3Gw) })
            .catch(error => {
                console.error("Is up failed:", error)
            })
        checks.push(prom)
    })

    return Promise.all(checks)
        .then(() => result)
        .catch(() => {
            return result
        })
}

/**
 * Implements the health check on the gateways pararrely checkig in /ping and
 * getGatewayInfo with a time limit of timeout.
 * Also the Web3Gateways are mapped to coresponding DvoteGateways in case the
 * should be chosen in a coupled manner
 * @param dvoteNodes The set of DvoteGateways to be checked
 * @param web3Nodes The set of available Web3Gateways
 * @returns A Gateway Object
 */
async function raceGateways(dvoteNodes: IDVoteGateway[], web3Nodes: IWeb3Gateway[], timeout: number = GATEWAY_SELECTION_TIMEOUT): Promise<{ dvote: IDVoteGateway[], web3: IWeb3Gateway[] }> {
    const result: { dvote: IDVoteGateway[], web3: IWeb3Gateway[] } = {
        dvote: [],
        web3: []
    }

    try {
        await Promise.race(dvoteNodes.map(node => node.isUp(timeout)
            .then(() => { result.dvote.push(node) })
            .catch(error => new Promise(resolve => setTimeout(resolve, timeout)))
        ))

        await Promise.race(web3Nodes
            .map(node =>
                node.isUp(timeout)
                    .then(() => { result.web3.push(node) })
                    .catch(error => new Promise(resolve => setTimeout(resolve, timeout)))
            ))

        if (!result.dvote.length && !result.web3.length) throw new Error("Could not find any active Gateway")
        return result
    } catch (err) {
        return result
    }
}

/**
 * Helper function that shuffles the elements of an array
 */
function shuffle(array) {
    var currentIndex = array.length
        , temporaryValue
        , randomIndex
        ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = JSON.parse(JSON.stringify(array[currentIndex]));
        array[currentIndex] = JSON.parse(JSON.stringify(array[randomIndex]));
        array[randomIndex] = temporaryValue;
    }

    return array;
}
