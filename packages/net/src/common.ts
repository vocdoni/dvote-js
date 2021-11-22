import { VocdoniEnvironment } from "@vocdoni/common"
import { DVoteGatewayResponseBody, IRequestParameters } from "./gateway-dvote"
import { BackendApiName, GatewayApiName } from "vocdoni-models" // TODO reference the future package
import { Contract, ContractInterface, providers, Signer, utils, Wallet } from "ethers"
import { IEnsPublicResolverContract, IGenesisContract, INamespacesContract, IProcessesContract, IResultsContract, ITokenStorageProofContract } from "@vocdoni/contract-wrappers"

// GATEWAY INTERFACES

export interface IGatewayDVoteClient {
    get supportedApis(): (GatewayApiName | BackendApiName)[]

    init(): Promise<any>

    get isReady(): boolean
    get dvoteUri(): string
    get environment(): VocdoniEnvironment

    sendRequest(requestBody: IRequestParameters, wallet?: Wallet | Signer, params?: { timeout: number }): Promise<DVoteGatewayResponseBody>
}

export interface IGatewayWeb3Client {
    get chainId(): Promise<number>
    get networkId(): Promise<string>
    get provider(): providers.BaseProvider
    get web3Uri(): string
    get archiveIpnsId(): string
    set archiveIpnsId(ipnsId: string)
    disconnect(): void

    deploy<CustomContractMethods>(abi: string | (string | utils.ParamType)[] | utils.Interface, bytecode: string,
                                  signParams: { signer?: Signer, wallet?: Wallet }, deployArguments: any[]): Promise<(Contract & CustomContractMethods)>
    attach<CustomContractMethods>(address: string, abi: ContractInterface): (Contract & CustomContractMethods)

    getEnsPublicResolverInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IEnsPublicResolverContract>
    getProcessesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IProcessesContract>
    getGenesisInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IGenesisContract>
    getNamespacesInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<INamespacesContract>
    getResultsInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<IResultsContract>
    getTokenStorageProofInstance(walletOrSigner?: Wallet | Signer, customAddress?: string): Promise<ITokenStorageProofContract>
}

export interface IGatewayClient extends IGatewayDVoteClient, IGatewayWeb3Client { }
