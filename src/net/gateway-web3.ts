// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { parseURL } from 'universal-parse-url'
import { Contract, ContractFactory, providers, Wallet, Signer, ContractInterface, BigNumber } from "ethers"
import { ProviderUtil } from "../util/providers"
import { GatewayInfo } from "../wrappers/gateway-info"
import { GATEWAY_SELECTION_TIMEOUT } from "../constants"
import { EthNetworkID } from "./gateway-bootnode"
import { IProcessContract, IEnsPublicResolverContract, INamespaceContract, ITokenStorageProofContract } from "../net/contracts"
import {
    PublicResolverContractDefinition,
    ProcessesContractDefinition,
    NamespacesContractDefinition,
    TokenStorageProofContractDefinition,
    EnsPublicResolverContractMethods,
    ProcessContractMethods,
    NamespaceContractMethods,
    TokenStorageProofContractMethods
} from "./contracts"
import { publicResolverEnsDomain, processesEnsDomain, namespacesEnsDomain, storageProofsEnsDomain } from "../constants"
import { promiseFuncWithTimeout, promiseWithTimeout } from '../util/timeout'

const { JsonRpcProvider, Web3Provider, IpcProvider, InfuraProvider, FallbackProvider, EtherscanProvider } = providers

// Export the class typings as an interface
export type IWeb3Gateway = InstanceType<typeof Web3Gateway>

/**
 * A Web3 wrapped client with utility methods to deploy and attach to Ethereum contracts.
 */
export class Web3Gateway {
    private _provider: providers.BaseProvider
    public ensPublicResolverContractAddress: string
    public namespacesContractAddress: string
    public processesContractAddress: string
    public tokenStorageProofContractAddress: string

    /**
     * Returns a wrapped Ethereum Web3 client.
     * @param gatewayOrProvider Can be a string with the host's URI or an Ethers Provider
     */
    constructor(gatewayOrProvider: string | GatewayInfo | providers.BaseProvider, networkId?: EthNetworkID, options: { testing: boolean } = { testing: false }) {
        if (!gatewayOrProvider) throw new Error("Invalid GatewayInfo or provider")
        else if (typeof gatewayOrProvider == "string") {
            if (!gatewayOrProvider) throw new Error("Invalid Gateway URI")

            const url = parseURL(gatewayOrProvider)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider, networkId, options)
        }
        else if (gatewayOrProvider instanceof GatewayInfo) {
            const url = parseURL(gatewayOrProvider.web3)
            if (url.protocol != "http:" && url.protocol != "https:") throw new Error("Unsupported gateway protocol: " + url.protocol)
            this._provider = ProviderUtil.fromUri(gatewayOrProvider.web3, networkId, options)
        }
        else if (gatewayOrProvider instanceof providers.BaseProvider) { // use as a provider
            this._provider = gatewayOrProvider
        }
        else throw new Error("A gateway URI or a provider is required")
    }

    /** Initialize the contract addresses */
    public async initEns() {
        const [addr1, addr2] = await Promise.all([
            this._provider.resolveName(publicResolverEnsDomain),
            this._provider.resolveName(processesEnsDomain)
        ])
        if (!addr1) throw new Error("The resolver address could not be fetched")
        else if (!addr2) throw new Error("The process contract address bould not be fetched")

        this.ensPublicResolverContractAddress = addr1
        this.processesContractAddress = addr2

        // Get namespace and storage proof addresses from the process contract
        const processInstance = this.attach<IProcessContract>(this.processesContractAddress, ProcessesContractDefinition.abi)

        const [addr3, addr4] = await Promise.all([
            processInstance.namespaceAddress(),
            processInstance.tokenStorageProofAddress()
        ])

        if (!addr3) throw new Error("The process contract didn't return a namespace address")
        else if (!addr4) throw new Error("The process contract didn't return a storage proof address")

        this.namespacesContractAddress = addr3
        this.tokenStorageProofContractAddress = addr4
    }

    /**
     * Deploy the contract using the given signer or wallet.
     * If a signer is given, its current connection will be used.
     * If a wallet is given, the Gateway URI will be used unless the wallet is already connected
     */
    async deploy<CustomContractMethods>(abi: ContractInterface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments?: any[]): Promise<(Contract & CustomContractMethods)> {
        var contractFactory: ContractFactory

        if (!signParams) throw new Error("Invalid signing parameters")
        let { signer, wallet } = signParams
        if (!signer && !wallet) throw new Error("A signer or a wallet is needed")
        else if (signer) {
            if (!signer.provider) throw new Error("A signer connected to a RPC provider ")

            contractFactory = new ContractFactory(abi, bytecode, signer)
        }
        else { // wallet
            if (!wallet.provider) {
                wallet = new Wallet(wallet.privateKey, this._provider)
            }

            contractFactory = new ContractFactory(abi, bytecode, wallet)
        }
        return (await contractFactory.deploy(...deployArguments)) as (Contract & CustomContractMethods)
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
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway instance
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
            return this.attach<EnsPublicResolverContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner.connect(this.provider)) as IEnsPublicResolverContract
        }
        return this.attach<EnsPublicResolverContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Process contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
     */
    public async getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessContract> {
        const contractAbi = ProcessesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.processesContractAddress
        }

        if (walletOrSigner) {
            return this.attach<ProcessContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner.connect(this.provider)) as IProcessContract
        }
        return this.attach<ProcessContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Namespace contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespaceContract> {
        const contractAbi = NamespacesContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.namespacesContractAddress
        }

        if (walletOrSigner) {
            return this.attach<NamespaceContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner.connect(this.provider)) as INamespaceContract
        }
        return this.attach<NamespaceContractMethods>(contractAddress, contractAbi)
    }

    /**
     * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.vocdoni.eth`
     */
    public async getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        const contractAbi = TokenStorageProofContractDefinition.abi as ContractInterface
        let contractAddress: string
        if (customAddress) contractAddress = customAddress
        else {
            if (!this.isReady) await this.initEns()
            contractAddress = this.tokenStorageProofContractAddress
        }

        if (walletOrSigner) {
            return this.attach<TokenStorageProofContractMethods>(contractAddress, contractAbi)
                .connect(walletOrSigner.connect(this.provider)) as ITokenStorageProofContract
        }
        return this.attach<TokenStorageProofContractMethods>(contractAddress, contractAbi)
    }
}
