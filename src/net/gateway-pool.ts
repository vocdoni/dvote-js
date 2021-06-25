import { Gateway } from "./gateway"
import { DVoteGateway, DVoteGatewayResponseBody, IRequestParameters } from "./gateway-dvote"
// import { clientApis, GatewayApiName } from "../models/gateway"
import {GatewayDiscovery, IGatewayActiveNodes, IGatewayDiscoveryParameters} from "./gateway-discovery"
import { Wallet, Signer, providers } from "ethers"
import { IProcessesContract, IEnsPublicResolverContract, INamespacesContract, ITokenStorageProofContract, IGenesisContract, IResultsContract } from "./contracts"
import { Web3Gateway } from "./gateway-web3"

const SEQUENTIAL_METHODS = ['addClaimBulk', 'publishCensus'] //generateProof and vote?
const ERROR_SKIP_METHODS = ['getRoot']
const GATEWAY_UPDATE_ERRORS = [
    "Time out",
    "read ECONNRESET",
    "censusId not valid or not found",
    "error fetching file: (not supported)",
    "not supported"
]
const MAX_GW_POOL_SHIFT_COUNT = 5
// const MAX_POOL_REFRESH_COUNT = 10

export type IGatewayPool = InstanceType<typeof GatewayPool>

// GLOBAL

/**
 * This is wrapper class Gateway, pooling many gateways together and allowing for automatic recconection
 */
export class GatewayPool {
    private dvotePool: DVoteGateway[] = []
    private web3Pool: Web3Gateway[] = []
    private params: IGatewayDiscoveryParameters = null
    private errorCount: number = 0
    public get supportedApis() { return this.activeDvoteClient.supportedApis }

    constructor(newPool: IGatewayActiveNodes, p: IGatewayDiscoveryParameters) {
        this.dvotePool = newPool.dvote
        this.web3Pool = newPool.web3
        this.params = p
    }

    /** Searches for healthy gateways and initialized them for immediate usage */
    public static discover(params: IGatewayDiscoveryParameters): Promise<GatewayPool> {
        return GatewayDiscovery.run(params)
            .then((bestNodes: IGatewayActiveNodes) => {

                const pool = new GatewayPool(bestNodes, params)

                return pool.init()
                    .then(() => pool)
            })
            .catch(error => {
                throw new Error(error)
            })
    }

    /** Ensures that the current active gateway is available for use */
    public init(): Promise<any> {
        return this.activeDvoteClient.init()
    }

    /** Sets the web3 polling flag to false */
    public disconnect() {
        this.activeWeb3Client.disconnect()
    }

    /** Launches a new discovery process and selects the healthiest gateway pair */
    public refresh(): Promise<void> {
        return GatewayDiscovery.run(this.params)
            .then((bestNodes: IGatewayActiveNodes) => {
                this.dvotePool = bestNodes.dvote
                this.web3Pool = bestNodes.web3
                this.errorCount = 0
            }).catch(error => {
                throw new Error(error)
            })
    }

    /**
     * Skips the currently active DVote gateway and connects using the next one
     */
    public shiftDVoteClient(): Promise<void> {
        if (this.errorCount > MAX_GW_POOL_SHIFT_COUNT || this.errorCount >= this.dvotePool.length) {
            this.errorCount = 0
            return Promise.reject(new Error("The operation cannot be completed"))
        }

        this.dvotePool.push(this.dvotePool.shift())
        return Promise.resolve()
    }

    /**
     * Skips the currently active Web3 gateway and connects using the next one
     */
    public shiftWeb3Client(): Promise<void> {
        if (this.errorCount > MAX_GW_POOL_SHIFT_COUNT || this.errorCount >= this.web3Pool.length) {
            this.errorCount = 0
            return Promise.reject(new Error("The operation cannot be completed"))
        }

        this.web3Pool.push(this.web3Pool.shift())
        return Promise.resolve()
    }

    public get activeDvoteClient(): DVoteGateway {
        if (!this.dvotePool || !this.dvotePool.length) throw new Error("The pool has no Dvote clients")
        return this.dvotePool[0]
    }

    public get activeWeb3Client(): Web3Gateway {
        if (!this.web3Pool || !this.web3Pool.length) throw new Error("The pool has no Web3 clients")
        return this.web3Pool[0]
    }

    public get isReady(): boolean {
        return this.activeWeb3Client.isReady && this.activeDvoteClient.isReady
    }

    // DVOTE

    public get dvoteUri(): string {
        return this.activeDvoteClient.uri
    }

    public sendRequest(requestBody: IRequestParameters, wallet: Wallet | Signer = null, params?: { timeout: number }): Promise<DVoteGatewayResponseBody> {
        if (!this.activeDvoteClient.supportsMethod(requestBody.method)) {
            this.errorCount += 1
            return this.shiftDVoteClient()
                .then(() => this.sendRequest(requestBody, wallet, params))
        }

        return this.activeDvoteClient.sendRequest(requestBody, wallet, params) // => capture time out exceptions
            .then((response: DVoteGatewayResponseBody) => {
                this.errorCount = 0
                return response
            })
            .catch((err: Error) => {
                if (ERROR_SKIP_METHODS.includes(requestBody.method)) {
                    throw err
                }

                if (SEQUENTIAL_METHODS.includes(requestBody.method))
                    throw new Error("Connection to gateway lost. The process needs to be reinitiated. Reason:" + err.message)

                // Check also for the census does not exist
                const result = GATEWAY_UPDATE_ERRORS.filter(msg => err.message.includes(msg))

                if (result.length) {
                    this.errorCount += 1
                    return this.shiftDVoteClient()
                        // Retry with a new one, if possible
                        .then(() => this.sendRequest(requestBody, wallet, params))
                }
                throw err
            })
    }

    // WEB3

    public get provider(): providers.BaseProvider { return this.activeWeb3Client.provider }
    public get web3Uri(): string { return this.activeWeb3Client.provider["connection"].url }

    public get chainId(): Promise<number> {
        return this.provider.getNetwork().then(network => network.chainId)
    }

    public get networkId(): Promise<string> {
        return this.provider.getNetwork().then(network => network.name)
    }

    public getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        return this.activeWeb3Client.getEnsPublicResolverInstance(walletOrSigner, customAddress)
    }

    public getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract> {
        return this.activeWeb3Client.getGenesisInstance(walletOrSigner, customAddress)
    }

    public getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract> {
        return this.activeWeb3Client.getNamespacesInstance(walletOrSigner, customAddress)
    }

    public getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract> {
        return this.activeWeb3Client.getProcessesInstance(walletOrSigner, customAddress)
    }

    public getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract> {
        return this.activeWeb3Client.getResultsInstance(walletOrSigner, customAddress)
    }

    public getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        return this.activeWeb3Client.getTokenStorageProofInstance(walletOrSigner, customAddress)
    }
}
