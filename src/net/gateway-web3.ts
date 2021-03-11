// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { parseURL } from 'universal-parse-url'
import { Contract, ContractFactory, providers, Wallet, Signer, ContractInterface, BigNumber } from "ethers"
import { ProviderUtil } from "../util/providers"
import { GatewayInfo } from "../wrappers/gateway-info"
import { GATEWAY_SELECTION_TIMEOUT, genesisEnsSubdomain, resultsEnsSubdomain } from "../constants"
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
import { productionEnsDomainSuffix, stagingEnsDomainSuffix, developmentEnsDomainSuffix, publicResolverEnsSubdomain, processesEnsSubdomain, namespacesEnsSubdomain, erc20StorageProofsEnsSubdomain } from "../constants"
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

        if (!gatewayOrProvider) throw new Error("Invalid GatewayInfo or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider, networkId)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider.web3, networkId)
        }
        else if (gatewayOrProvider instanceof providers.BaseProvider) { // use as a provider
            this._provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
    }

    /** Initialize the contract addresses */
    public async initEns() {
        let domainSuffix: string
        switch (this._environment) {
            case "prod":
                domainSuffix = productionEnsDomainSuffix
                break
            case "stg":
                domainSuffix = stagingEnsDomainSuffix
                break
            case "dev":
                domainSuffix = developmentEnsDomainSuffix
                break
        }

        const addresses = await Promise.all([
            this._provider.resolveName(publicResolverEnsSubdomain + domainSuffix),
            this._provider.resolveName(genesisEnsSubdomain + domainSuffix),
            this._provider.resolveName(namespacesEnsSubdomain + domainSuffix),
            this._provider.resolveName(processesEnsSubdomain + domainSuffix),
            this._provider.resolveName(resultsEnsSubdomain + domainSuffix),
            this._provider.resolveName(erc20StorageProofsEnsSubdomain + domainSuffix),
        ])
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
    }

    /** Sets the polling flag to false */
    public disconnect() {
        this._provider.polling = false
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
        return !!this._provider &&
            !!this.ensPublicResolverContractAddress &&
            !!this.processesContractAddress &&
            !!this.namespacesContractAddress &&
            !!this.tokenStorageProofContractAddress
    }

    public isUp(timeout: number = GATEWAY_SELECTION_TIMEOUT, checkEns?: boolean): Promise<any> {
        return promiseFuncWithTimeout(() => {
            return this.getPeers()
                .then(peersNumber => {
                    if (peersNumber <= 0) throw new Error("The Web3 gateway has no peers")
                    return this.isSyncing()
                })
                .then(syncing => {
                    if (syncing) throw new Error("The Web3 gateway is syncing")
                    else if (this.isReady) return // done
                    else if (!checkEns) return // done

                    // Fetch and set the contract addresses
                    return this.initEns()
                })
                .then(() => null)
                .catch(err => {
                    // console.error(err)
                    if (err.message == "The Web3 gateway is syncing")
                        throw new Error(err.message)
                    else
                        throw new Error("The Web3 Gateway seems to be down")
                })
        }, timeout, "The Web3 Gateway is too slow")
    }

    /** Determines whether the current Web3 provider is syncing blocks or not. Several types of prviders may always return false. */
    public isSyncing(): Promise<boolean> {
        if (!this._provider) return Promise.resolve(false)
        else if (this._provider instanceof JsonRpcProvider || this._provider instanceof Web3Provider || this._provider instanceof IpcProvider || this._provider instanceof InfuraProvider) {
            return this._provider.send("eth_syncing", []).then(result => !!result)
        }
        // else if (this._provider instanceof FallbackProvider || this._provider instanceof EtherscanProvider) {}

        return Promise.resolve(false)
    }

    /** Request the amount of peers the Gateway is currently connected to */
    public getPeers(): Promise<number> {
        if (!this._provider) return Promise.resolve(0)
        else if (!(this._provider instanceof JsonRpcProvider) && !(this._provider instanceof Web3Provider) &&
            !(this._provider instanceof IpcProvider) && !(this._provider instanceof InfuraProvider)) {
            return Promise.resolve(0)
        }

        return this._provider.send("net_peerCount", []).then(result => {
            if (!result) return -1
            return BigNumber.from(result).toNumber()
        })
    }

    ///////////////////////////////////////////////////////////////////////////
    // CONTRACT INSTANCE GETTERS
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway client
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public async getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        const contractAbi = PublicResolverContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract> {
        const contractAbi = GenesisContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract> {
        const contractAbi = NamespacesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public async getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract> {
        const contractAbi = ProcessesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract> {
        const contractAbi = ResultsContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        const contractAbi = Erc20StorageProofContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
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
