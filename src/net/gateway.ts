// NOTE:
// This component is meant to be a simple communication wrapper.
// It provides a wrapper to use a Vocdoni Gateway, as well as a wrapper a Web3 one

import { Contract, providers, utils, Wallet, Signer, ContractInterface } from "ethers"
import { GatewayInfo } from "../wrappers/gateway-info"
import { GatewayApiName, BackendApiName, ApiMethod } from "../models/gateway"
import { GatewayBootnode, EthNetworkID } from "./gateway-bootnode"
import { ContentUri } from "../wrappers/content-uri"
import { IProcessesContract, IEnsPublicResolverContract, INamespacesContract, ITokenStorageProofContract, IGenesisContract, IResultsContract } from "../net/contracts"
import { DVoteGateway, IDVoteGateway, IRequestParameters } from "./gateway-dvote"
import { IWeb3Gateway, Web3Gateway } from "./gateway-web3"
import { VocdoniEnvironment } from "../models/common"


// Export the class typings as an interface
export type IGateway = InstanceType<typeof Gateway>

/**
 * This is class, addressed to the end user, is a wrapper of DvoteGateway and Web3Gateway
 */
export class Gateway {
    protected dvote: DVoteGateway = null
    protected web3: Web3Gateway = null
    public get health() { return this.dvote.health }
    public get weight() { return this.dvote.weight }
    public get publicKey() { return this.dvote.publicKey }
    public get supportedApis() { return this.dvote.supportedApis }

    /**
     * Returns a new Gateway
     * @param dvoteGateway A DvoteGateway instance
     * @param web3Gateway A Web3Gateway instance
     */
    constructor(dvoteGateway: IDVoteGateway, web3Gateway: IWeb3Gateway) {
        if (!dvoteGateway || !web3Gateway ||
            !(dvoteGateway instanceof DVoteGateway) || !(web3Gateway instanceof Web3Gateway)) {
            throw new Error("Invalid gateways provided")
        }
        this.dvote = dvoteGateway
        this.web3 = web3Gateway
    }

    /**
     * Returns a new random Gateway that is attached to the required network
     * @param networkId Either "mainnet", "rinkeby" or "goerli" (test)
     * @param requiredApis A list of the required APIs
     */
    static randomFromDefault(networkId: EthNetworkID, requiredApis: (GatewayApiName | BackendApiName)[] = [], environment: VocdoniEnvironment): Promise<Gateway> {
        return GatewayBootnode.getDefaultGateways(networkId, environment)
            .then(async bootNodeData => {
                if (!bootNodeData[networkId]) throw new Error("The bootnode doesn't define any gateway for " + networkId)

                const gateways = GatewayBootnode.digestNetwork(bootNodeData, networkId, environment)

                // TODO: Filter by required API's
                const [web3, dvote] = await Promise.all([
                    Promise.race(gateways.web3.map(w3 => w3.check().then(() => w3))),
                    Promise.race(gateways.dvote.map(dv => dv.isUp().then(() => dv)))
                ])
                if (!web3) throw new Error("Could not find an active Web3 Gateway")
                else if (!dvote) throw new Error("Could not find an active DVote Gateway")

                return new Gateway(dvote, web3)
            })
    }

    /**
     * Returns a new random Gateway that is attached to the required network
     * @param networkId Either "mainnet", "rinkeby" or "goerli" (test)
     * @param bootnodesContentUri The uri from which contains the available gateways
     * @param requiredApis A list of the required APIs
     */
    static randomfromUri(networkId: EthNetworkID, bootnodesContentUri: string | ContentUri, requiredApis: (GatewayApiName | BackendApiName)[] = [], environment: VocdoniEnvironment): Promise<Gateway> {
        return GatewayBootnode.getGatewaysFromUri(bootnodesContentUri)
            .then(async bootNodeData => {
                if (!bootNodeData[networkId]) throw new Error("The bootnode doesn't define any gateway for " + networkId)

                const gateways = GatewayBootnode.digestNetwork(bootNodeData, networkId, environment)

                // TODO: Filter by required API's
                const [web3, dvote] = await Promise.all([
                    Promise.race(gateways.web3.map(w3 => w3.check().then(() => w3))),
                    Promise.race(gateways.dvote.map(dv => dv.isUp().then(() => dv)))
                ])
                if (!web3) throw new Error("Could not find an active Web3 Gateway")
                else if (!dvote) throw new Error("Could not find an active DVote Gateway")

                return new Gateway(dvote, web3)
            })
    }

    /**
     * Returns a new *connected* Gateway that is instantiated based on the given parameters
     * @param gatewayOrParams Either a gatewayInfo object or an object with the defined parameters
     */
    static fromInfo(gatewayOrParams: GatewayInfo | { dvoteUri: string, supportedApis: GatewayApiName[], web3Uri: string, publicKey?: string }, environment: VocdoniEnvironment): Promise<Gateway> {
        let dvoteGateway, web3Gateway
        if (gatewayOrParams instanceof GatewayInfo) {
            dvoteGateway = new DVoteGateway(gatewayOrParams)
            web3Gateway = new Web3Gateway(gatewayOrParams, null, environment)
        } else if (gatewayOrParams instanceof Object) {
            if (!(typeof gatewayOrParams.dvoteUri === "string") ||
                !(Array.isArray(gatewayOrParams.supportedApis)) ||
                !(typeof gatewayOrParams.web3Uri === "string"))
                throw new Error("Invalid Parameters")
            dvoteGateway = new DVoteGateway({
                uri: gatewayOrParams.dvoteUri,
                supportedApis: gatewayOrParams.supportedApis,
                publicKey: gatewayOrParams.publicKey
            })
            web3Gateway = new Web3Gateway(gatewayOrParams.web3Uri, null, environment)
        }
        const gateway = new Gateway(dvoteGateway, web3Gateway)
        return gateway.init()
            .then(() => gateway)
            .catch(error => {
                throw new Error("Could not connect to the chosen gateway: " + error)
            })
    }

    /**
     * Initializes and checks the connection of the DVote node.
     * @param requiredApis Expected DVote APIs
     */
    public init(requiredApis: (GatewayApiName | BackendApiName)[] = []): Promise<void> {
        return this.dvote.init(requiredApis)
    }

    /** Sets the web3 polling flag to false */
    public disconnect() {
        this.web3.disconnect()
    }

    public get isReady(): boolean {
        return this.web3.isReady && this.dvote.isReady
    }

    // DVOTE

    async isDVoteUp(requiredApis: (GatewayApiName | BackendApiName)[] = []): Promise<boolean> {
        return this.dvote.isUp()
            .then(() => {
                if (!this.dvote.supportedApis) return false
                else if (!requiredApis.length) return true
                else if (requiredApis.length && requiredApis.every(api => this.dvote.supportedApis.includes(api)))
                    return true
                return false
            }).catch(error => {
                throw new Error(error)
            })
    }

    public get dvoteUri() { return this.dvote.uri }

    public get chainId(): Promise<number> {
        return this.provider.getNetwork().then(network => network.chainId)
    }

    public get networkId(): Promise<string> {
        return this.provider.getNetwork().then(network => network.name)
    }

    /**
     * Send a message to a Vocdoni Gateway and return the response
     * @param requestBody Parameters of the request to send. The timestamp (in seconds) will be added to the object.
     * @param wallet (optional) The wallet to use for signing (default: null)
     * @param params (optional) Optional parameters. Timeout in milliseconds.
     */
    public sendRequest(requestBody: IRequestParameters, wallet: Wallet | Signer = null, params?: { timeout: number }) {
        return this.dvote.sendRequest(requestBody, wallet, params)
    }

    public getInfo(timeout: number = 2 * 1000): Promise<{ apiList: (GatewayApiName | BackendApiName)[], health: number }> {
        return this.dvote.getInfo(timeout)
    }

    public supportsMethod(method: ApiMethod): boolean {
        return this.dvote.supportsMethod(method)
    }

    // WEB3
    public isWeb3Up(): Promise<boolean> {
        return this.web3.check()
            .then(() => true)
            .catch(() => false)
    }

    public get provider(): providers.BaseProvider { return this.web3.provider }
    public get web3Uri(): string { return this.web3.provider["connection"].url }

    public deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
        signParams: { signer?: Signer, wallet?: Wallet } = {}, deployArguments: any[] = []): Promise<(Contract & CustomContractMethods)> {

        return this.web3.deploy<CustomContractMethods>(abi, bytecode, signParams, deployArguments)
    }

    public attach<CustomContractMethods>(address: string, abi: ContractInterface): (Contract & CustomContractMethods) {
        return this.web3.attach<CustomContractMethods>(address, abi)
    }

    /**
     * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
     */
    public getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract> {
        return this.web3.getEnsPublicResolverInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Process contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
     */
    public getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract> {
        return this.web3.getProcessesInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Genesis contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract> {
        return this.web3.getGenesisInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Namespaces contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract> {
        return this.web3.getNamespacesInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Results contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract> {
        return this.web3.getResultsInstance(walletOrSigner, customAddress)
    }

    /**
     * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway instance
     * @param walletOrSigner (optional) Either an ethers.js Wallet or a Signer
     * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
     */
    public getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract> {
        return this.web3.getTokenStorageProofInstance(walletOrSigner, customAddress)
    }
}
