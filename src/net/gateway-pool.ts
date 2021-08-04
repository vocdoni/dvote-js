import { VocdoniEnvironment } from "../models/common";
import { Gateway } from "./gateway"
import { DVoteGatewayResponseBody, IRequestParameters } from "./gateway-dvote"
import { GatewayDiscovery, IGatewayDiscoveryParameters } from "./gateway-discovery"
import { Wallet, Signer, providers, utils, Contract, ContractInterface } from "ethers"
import { IProcessesContract, IEnsPublicResolverContract, INamespacesContract, ITokenStorageProofContract, IGenesisContract, IResultsContract } from "./contracts"
import { IGatewayClient } from "../common"

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

// GLOBAL

/**
 * This is wrapper class Gateway, pooling many gateways together and allowing for automatic recconection
 */
export class GatewayPool implements IGatewayClient {
    private pool: Gateway[] = []
    private params: IGatewayDiscoveryParameters = null
    private errorCount: number = 0
    public get supportedApis() { return this.activeGateway.supportedApis }

    constructor(newPool: Gateway[], p: IGatewayDiscoveryParameters) {
        this.pool = newPool
        this.params = p
    }

    /** Searches for healthy gateways and initialized them for immediate usage */
    static discover(params: IGatewayDiscoveryParameters): Promise<GatewayPool> {
        return GatewayDiscovery.run(params)
            .then((bestNodes: Gateway[]) => {
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
        return this.activeGateway.init()
    }

    /** Sets the web3 polling flag to false */
    public disconnect() {
        this.activeGateway.disconnect()
    }

    /** Launches a new discovery process and selects the healthiest gateway pair */
    public refresh(): Promise<void> {
        return GatewayDiscovery.run(this.params)
            .then((bestNodes: Gateway[]) => {
                this.pool = bestNodes
                this.errorCount = 0
            }).catch(error => {
                throw new Error(error)
            })
    }

    /**
     * Skips the currently active gateway and connects using the next one
     */
    public shift(): Promise<void> {
        if (this.errorCount > MAX_GW_POOL_SHIFT_COUNT || this.errorCount >= this.pool.length) {
            this.errorCount = 0
            return Promise.reject(new Error("The operation cannot be completed"))
        }

        this.pool.push(this.pool.shift())
        return Promise.resolve()
    }

    public get activeGateway(): Gateway {
        if (!this.pool || !this.pool.length) throw new Error("The pool has no gateways")
        return this.pool[0]
    }

    public get isReady(): boolean {
        return this.activeGateway.isReady
    }

    public getArchiveUri(): string {
        return this.activeGateway.getArchiveUri()
    }

    public setArchiveUri(uri: string) {
        this.activeGateway.setArchiveUri(uri)
    }

    public getEnvironment(): VocdoniEnvironment {
        return this.activeGateway.getEnvironment()
    }

    // DVOTE

    public get dvoteUri(): string {
        return this.activeGateway.dvoteUri
    }

    public sendRequest(requestBody: IRequestParameters, wallet: Wallet | Signer = null, params?: { timeout: number }): Promise<DVoteGatewayResponseBody> {
        if (!this.activeGateway.supportsMethod(requestBody.method)) {
            this.errorCount += 1
            return this.shift()
                // Retry with a new one, if possible
                .then(() => this.sendRequest(requestBody, wallet, params))
        }

        return this.activeGateway.sendRequest(requestBody, wallet, params) // => capture time out exceptions
            .then(response => {
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
                    return this.shift()
                        // Retry with a new one, if possible
                        .then(() => this.sendRequest(requestBody, wallet, params))
                }
                throw err
            })
    }

    // WEB3

    public get provider(): providers.BaseProvider { return this.activeGateway.provider }
    public get web3Uri(): string { return this.activeGateway.web3Uri }

    public get chainId(): Promise<number> {
        return this.provider.getNetwork().then(network => network.chainId)
    }

    public get networkId(): Promise<string> {
        return this.provider.getNetwork().then(network => network.name)
    }

    public deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {

        return this.activeGateway.deploy<CustomContractMethods>(abi, bytecode, signParams, deployArguments)
    }

    public attach<CustomContractMethods>(address: string, abi: ContractInterface): (Contract & CustomContractMethods) {
        return this.activeGateway.attach<CustomContractMethods>(address, abi)
    }

    public getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        return this.activeGateway.getEnsPublicResolverInstance(walletOrSigner, customAddress)
    }

    public getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract> {
        return this.activeGateway.getGenesisInstance(walletOrSigner, customAddress)
    }

    public getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract> {
        return this.activeGateway.getNamespacesInstance(walletOrSigner, customAddress)
    }

    public getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract> {
        return this.activeGateway.getProcessesInstance(walletOrSigner, customAddress)
    }

    public getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract> {
        return this.activeGateway.getResultsInstance(walletOrSigner, customAddress)
    }

    public getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        return this.activeGateway.getTokenStorageProofInstance(walletOrSigner, customAddress)
    }
}
