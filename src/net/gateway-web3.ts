// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { parseURL } from 'universal-parse-url'
import { Contract, ContractFactory, providers, Wallet, Signer, ContractInterface, BigNumber } from "ethers"
import { ProviderUtil } from "../util/providers"
import { GatewayInfo } from "../wrappers/gateway-info"
import {
    GATEWAY_SELECTION_TIMEOUT,
    GENESIS_ENS_SUBDOMAIN,
    RESULTS_ENS_SUBDOMAIN,
    VOCDONI_ENS_ROOT,
    VOCDONI_ENS_ROOT_STAGING,
    VOCDONI_ENS_ROOT_DEV,
    ENTITY_RESOLVER_ENS_SUBDOMAIN,
    PROCESSES_ENS_SUBDOMAIN,
    NAMESPACES_ENS_SUBDOMAIN,
    ERC20_STORAGE_PROOFS_ENS_SUBDOMAIN
} from "../constants"
import { EthNetworkID } from "./gateway-bootnode"
import { IProcessesContract, IEnsPublicResolverContract, INamespacesContract, ITokenStorageProofContract, IGenesisContract, IResultsContract } from "../net/contracts"
import {
    PublicResolverContractDefinition,
    GenesisContractDefinition,
    NamespacesContractDefinition,
    ProcessesContractDefinition,
    ResultsContractDefinition,
    Erc20StorageProofContractDefinition,

    EnsResolverContractMethods,
    GenesisContractMethods,
    NamespacesContractMethods,
    ProcessesContractMethods,
    ResultsContractMethods,
    Erc20StorageProofContractMethods
} from "./contracts"
import { promiseFuncWithTimeout, promiseWithTimeout } from '../util/timeout'
import { VocdoniEnvironment } from '../models/common'

const { JsonRpcProvider, Web3Provider, IpcProvider, InfuraProvider, FallbackProvider, EtherscanProvider } = providers

// Export the class typings as an interface
export type IWeb3Gateway = InstanceType<typeof Web3Gateway>

/**
 * A Web3 wrapped client with utility methods to deploy and attach to Ethereum contracts.
 */
export class Web3Gateway {
    private _provider: providers.BaseProvider
    private _environment: VocdoniEnvironment
    private _initializingEns: Promise<any>
    private _hasTimeOutLastRequest: boolean
    private _archiveIpnsId: string
    public performanceTime: number
    public weight: number
    public peerCount: number
    public lastBlockNumber: number
    public ensPublicResolverContractAddress: string
    public genesisContractAddress: string
    public namespacesContractAddress: string
    public processesContractAddress: string
    public resultsContractAddress: string
    public tokenStorageProofContractAddress: string

    /**
     * Returns a wrapped Ethereum Web3 client.
     * @param gatewayOrProvider Can be a string with the host's URI or an Ethers Provider
     */
    constructor(gatewayOrProvider: string | GatewayInfo | providers.BaseProvider, networkId: EthNetworkID = "xdai", environment: VocdoniEnvironment = "prod") {
        if (!["prod", "stg", "dev"].includes(environment)) throw new Error("Invalid environment")
        this._environment = environment
        this.performanceTime = 0

        if (!gatewayOrProvider) throw new Error("Invalid GatewayInfo or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider, networkId, environment)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider.web3, networkId, environment)
        }
        else if (gatewayOrProvider instanceof providers.BaseProvider) { // use as a provider
            this._provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
    }

    /** Initialize the contract addresses */
    public initEns() {
        if (this._initializingEns) return this._initializingEns

        let rootDomain: string
        switch (this._environment) {
            case "prod":
                rootDomain = VOCDONI_ENS_ROOT
                break
            case "stg":
                rootDomain = VOCDONI_ENS_ROOT_STAGING
                break
            case "dev":
                rootDomain = VOCDONI_ENS_ROOT_DEV
                break
            default:
                throw new Error("Invalid environment")
        }

        this._initializingEns = Promise.all([
            this._provider.resolveName(ENTITY_RESOLVER_ENS_SUBDOMAIN + "." + rootDomain),
            this._provider.resolveName(GENESIS_ENS_SUBDOMAIN + "." + rootDomain),
            this._provider.resolveName(NAMESPACES_ENS_SUBDOMAIN + "." + rootDomain),
            this._provider.resolveName(PROCESSES_ENS_SUBDOMAIN + "." + rootDomain),
            this._provider.resolveName(RESULTS_ENS_SUBDOMAIN + "." + rootDomain),
            this._provider.resolveName(ERC20_STORAGE_PROOFS_ENS_SUBDOMAIN + "." + rootDomain),
        ]).then(addresses => {
            if (!addresses[0]) throw new Error("The ENS resolver address could not be fetched")
            else if (!addresses[1]) throw new Error("The genesis contract address could not be fetched")
            else if (!addresses[2]) throw new Error("The namespaces contract address could not be fetched")
            else if (!addresses[3]) throw new Error("The processes contract address could not be fetched")
            else if (!addresses[4]) throw new Error("The results contract address could not be fetched")
            else if (!addresses[5]) throw new Error("The ERC20 proofs contract address could not be fetched")

            this.ensPublicResolverContractAddress = addresses[0]
            this.genesisContractAddress = addresses[1]
            this.namespacesContractAddress = addresses[2]
            this.processesContractAddress = addresses[3]
            this.resultsContractAddress = addresses[4]
            this.tokenStorageProofContractAddress = addresses[5]

            this._initializingEns = null
        }).catch(err => {
            this._initializingEns = null

            throw err
        })

        return this._initializingEns
    }

    /** Sets the polling flag to false */
    public disconnect() {
        this._provider.polling = false
    }

    public get hasTimeOutLastRequest() { return this._hasTimeOutLastRequest }

    public get archiveIpnsId(): string {
        return this._archiveIpnsId
    }

    public set archiveIpnsId(ipnsId: string) {
        this._archiveIpnsId = ipnsId
    }

    /**
     * Deploy the contract using the given signer or wallet.
     * If a signer is given, its current connection will be used.
     * If a wallet is given, the Gateway URI will be used unless the wallet is already connected
     */
    deploy<CustomContractMethods>(abi: ContractInterface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {
        var contractFactory: ContractFactory

        if (!signParams) return Promise.reject(new Error("Invalid signing parameters"))
        let { signer, wallet } = signParams
        if (!signer && !wallet) return Promise.reject(new Error("A signer or a wallet is needed"))
        else if (signer) {
            if (!signer.provider) return Promise.reject(new Error("A signer connected to a RPC provider is needed"))

            contractFactory = new ContractFactory(abi, bytecode, signer)
        }
        else { // wallet
            if (!wallet.provider) {
                wallet = new Wallet(wallet.privateKey, this._provider)
            }

            contractFactory = new ContractFactory(abi, bytecode, wallet)
        }
        return contractFactory
            .deploy(...deployArguments)
            .then(response => response as (Contract & CustomContractMethods))
    }

    /**
     * Use the contract instance at the given address using the Gateway as a provider
     * @param address Contract instance address
     * @return A contract instance attached to the given address
     */
    attach<CustomContractMethods>(address: string, abi: ContractInterface): (Contract & CustomContractMethods) {
        if (typeof address != "string") throw new Error("Invalid contract address")
        else if (!abi) throw new Error("Invalid contract ABI")

        return new Contract(address, abi, this._provider) as (Contract & CustomContractMethods)
    }

    /** Returns a JSON RPC provider associated to the initial Gateway URI */
    public get provider() {
        return this._provider
    }

    /** Returns true if the provider and contract details are properly set */
    public get isReady(): boolean {
        return !!this._provider && (
            !!this.ensPublicResolverContractAddress ||
            !!this.genesisContractAddress ||
            !!this.processesContractAddress ||
            !!this.namespacesContractAddress ||
            !!this.resultsContractAddress ||
            !!this.tokenStorageProofContractAddress
        )
    }

    /**
     * Checks the Gateway healthy by requesting and calculating certain metrics
     *
     * @param timeout
     * @param resolveEnsDomains
     */
    public checkStatus(timeout: number = GATEWAY_SELECTION_TIMEOUT, resolveEnsDomains: boolean = false): Promise<void> {
        this._hasTimeOutLastRequest = false
        return promiseWithTimeout(
                this.getMetrics(timeout, resolveEnsDomains), timeout, "The Web3 Gateway is too slow"
            )
            .catch((error) => {
                // TODO refactor errors
                if (error && error.message == "The Web3 Gateway is too slow") {
                    this._hasTimeOutLastRequest = true
                }
                throw error
            })
    }

    /**
     * The needed metrics for evaluating Gateways during the discovery process are called here.
     * It also will calculate the response time for each call as a metric itself
     *
     * @param timeout
     * @param resolveEnsDomains
     */
    private getMetrics(timeout: number, resolveEnsDomains: boolean): Promise<void> {
        const metrics = [
            this.getBlockNumber(),
            this.getPeers(),
            this.isSyncing(),
        ]
        if (resolveEnsDomains) metrics.push(this.checkEns())
        return Promise.all(metrics)
            .then(() => {
                this.weight = Math.round(
                    Math.floor(Math.random() * 100) * (40 / 100)
                    + (100 * (timeout - this.performanceTime) / timeout) * (60 / 100)
                )
            })
    }

    /** Determines whether the current Web3 provider is syncing blocks or not. Several types of prviders may always return false. */
    public isSyncing(): Promise<void> {
        if (!this._provider) return Promise.reject()
        else if (this._provider instanceof JsonRpcProvider || this._provider instanceof Web3Provider || this._provider instanceof IpcProvider || this._provider instanceof InfuraProvider) {
            let performanceTime = new Date().getTime()
            return this._provider.send("eth_syncing", []).then(result => {
                performanceTime = Math.round(new Date().getTime() - performanceTime)
                this.performanceTime = performanceTime > this.performanceTime ? performanceTime : this.performanceTime
                return !!result ? Promise.reject() : Promise.resolve()
            })
        }

        return Promise.reject()
    }

    /** Request the amount of peers the Gateway is currently connected to */
    public getPeers(): Promise<void> {
        // TODO Review if not rejecting and setting peerCount = -1 is the best solution
        if (!this._provider) return Promise.reject()
        else if (!(this._provider instanceof JsonRpcProvider) && !(this._provider instanceof Web3Provider) &&
            !(this._provider instanceof IpcProvider) && !(this._provider instanceof InfuraProvider)) {
            return Promise.reject()
        }

        let performanceTime = new Date().getTime()
        return this._provider.send("net_peerCount", [])
            .then(result => {
                // TODO maybe not needed Exception here
                if (!result) throw new Error('peersCount not available for web3 gateway')
                performanceTime = Math.round(new Date().getTime() - performanceTime)
                this.performanceTime = performanceTime > this.performanceTime ? performanceTime : this.performanceTime
                this.peerCount = BigNumber.from(result).toNumber()
            })
            .catch(err => {
                this.peerCount = -1
            })
    }

    /** Request the block number of the Gateway which is currently connected to */
    public getBlockNumber(): Promise<void> {
        if (!this._provider) {
            return Promise.reject()
        } else if (!(this._provider instanceof JsonRpcProvider) && !(this._provider instanceof Web3Provider) &&
            !(this._provider instanceof IpcProvider) && !(this._provider instanceof InfuraProvider)) {
            return Promise.reject()
        }

        let performanceTime = new Date().getTime()
        return this._provider.getBlockNumber().then((blockNumber) => {
            performanceTime = Math.round(new Date().getTime() - performanceTime)
            this.performanceTime = performanceTime > this.performanceTime ? performanceTime : this.performanceTime
            this.lastBlockNumber = blockNumber
        });
    }

    public checkEns(): Promise<void> {
        let rootDomain: string
        switch (this._environment) {
            case "prod":
                rootDomain = VOCDONI_ENS_ROOT
                break
            case "stg":
                rootDomain = VOCDONI_ENS_ROOT_STAGING
                break
            case "dev":
                rootDomain = VOCDONI_ENS_ROOT_DEV
                break
            default:
                throw new Error("Invalid environment")
        }

        let performanceTime = new Date().getTime()
        return this._provider.resolveName(ENTITY_RESOLVER_ENS_SUBDOMAIN + "." + rootDomain)
            .then((address) => {
                performanceTime = Math.round(new Date().getTime() - performanceTime)
                this.performanceTime = performanceTime > this.performanceTime ? performanceTime : this.performanceTime
                this.ensPublicResolverContractAddress = address
            })
    }

    ///////////////////////////////////////////////////////////////////////////
    // CONTRACT INSTANCE GETTERS
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
     */
    public async getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        const contractAbi = PublicResolverContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.ensPublicResolverContractAddress) await this.initEns()
            contractAddress = this.ensPublicResolverContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<EnsResolverContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as IEnsPublicResolverContract
            }
            // Signers' provider can't be manually set
            return this.attach<EnsResolverContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IEnsPublicResolverContract
        }
        return this.attach<EnsResolverContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Genesis contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public async getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract> {
        const contractAbi = GenesisContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.genesisContractAddress) await this.initEns()
            contractAddress = this.genesisContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<GenesisContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as IGenesisContract
            }
            // Signers' provider can't be manually set
            return this.attach<GenesisContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IGenesisContract
        }
        return this.attach<GenesisContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Namespace contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public async getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract> {
        const contractAbi = NamespacesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.namespacesContractAddress) await this.initEns()
            contractAddress = this.namespacesContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<NamespacesContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as INamespacesContract
            }
            // Signers' provider can't be manually set
            return this.attach<NamespacesContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as INamespacesContract
        }
        return this.attach<NamespacesContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Process contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
     */
    public async getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract> {
        const contractAbi = ProcessesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.processesContractAddress) await this.initEns()
            contractAddress = this.processesContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<ProcessesContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as IProcessesContract
            }
            // Signers' provider can't be manually set
            return this.attach<ProcessesContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IProcessesContract
        }
        return this.attach<ProcessesContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Results contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public async getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract> {
        const contractAbi = ResultsContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.resultsContractAddress) await this.initEns()
            contractAddress = this.resultsContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<ResultsContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as IResultsContract
            }
            // Signers' provider can't be manually set
            return this.attach<ResultsContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as IResultsContract
        }
        return this.attach<ResultsContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public async getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        const contractAbi = Erc20StorageProofContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.tokenStorageProofContractAddress) await this.initEns()
            contractAddress = this.tokenStorageProofContractAddress
        }

        if (walletOrSigner) {
            if (walletOrSigner instanceof Wallet) {
                return this.attach<Erc20StorageProofContractMethods>(contractAddress, contractAbi)
                    .connect(walletOrSigner.connect(this.provider)) as ITokenStorageProofContract
            }
            // Signers' provider can't be manually set
            return this.attach<Erc20StorageProofContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner) as ITokenStorageProofContract
        }
        return this.attach<Erc20StorageProofContractMethods>(contractAddress, contractAbi)
    }
}
