import { Contract, providers, Wallet, Signer } from "ethers"
import { Web3Gateway } from "./gateway"
import { publicResolverEnsDomain, processesEnsDomain, namespacesEnsDomain, storageProofsEnsDomain } from "../constants"
import {
    EnsPublicResolver as EntityContractDefinition,
    Namespace as NamespaceContractDefinition,
    Process as ProcessContractDefinition,
    EnsPublicResolverContractMethods,
    NamespaceContractMethods,
    TokenStorageProofContractMethods,
    ProcessContractMethods
} from "dvote-solidity"

export interface IEnsPublicResolverContract extends Contract, EnsPublicResolverContractMethods { }
export interface INamespaceContract extends Contract, NamespaceContractMethods { }
export interface ITokenStorageProofContract extends Contract, TokenStorageProofContractMethods { }
export interface IProcessContract extends Contract, ProcessContractMethods { }
export { ensHashAddress } from "dvote-solidity"

type DeployContractParams = { gateway?: string, provider?: providers.BaseProvider, signer?: Signer; wallet?: Wallet; }
type AttachToContractParams = { gateway?: string, provider?: providers.BaseProvider, signer?: Signer; wallet?: Wallet; }

const nullAddress = "0x0000000000000000000000000000000000000000"

///////////////////////////////////////////////////////////////////////////////
// DEPLOYMENT
///////////////////////////////////////////////////////////////////////////////

/**
 * Deploy a contract and return the newly created instance of an Entity Resolver
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function deployEnsPublicResolverContract(params: DeployContractParams = {}): Promise<IEnsPublicResolverContract> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const instance = await gw.deploy<EnsPublicResolverContractMethods>(EntityContractDefinition.abi, EntityContractDefinition.bytecode, { signer, wallet }, [nullAddress])

    if (signer) {
        return instance.connect(signer) as IEnsPublicResolverContract
    }
    else { // if we reach this point, then wallet myst have been set
        if (!wallet.provider) wallet = wallet.connect(gw.provider)
        return instance.connect(wallet) as IEnsPublicResolverContract
    }
}

/**
 * Deploy a contract and return the newly created instance of a Namespace
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function deployNamespaceContract(params: DeployContractParams = {}): Promise<INamespaceContract> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const instance = await gw.deploy<NamespaceContractMethods>(NamespaceContractDefinition.abi, NamespaceContractDefinition.bytecode, { signer, wallet })

    if (signer) {
        return instance.connect(signer) as INamespaceContract
    }
    else { // if we reach this point, then wallet myst have been set
        if (!wallet.provider) wallet = wallet.connect(gw.provider)
        return instance.connect(wallet) as INamespaceContract
    }
}

/**
 * Deploy a contract and return the newly created instance of a Voting Process
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function deployProcessContract(params: DeployContractParams = {}, deployArguments: [string, string]): Promise<IProcessContract> {
    if (!deployArguments || deployArguments.length != 2) throw new Error("Expecting 2 deploy arguments")
    else if (typeof deployArguments[0] != "string") throw new Error("Invalid predecessor address")
    else if (typeof deployArguments[1] != "string") throw new Error("Invalid namespace address")

    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const instance = await gw.deploy<ProcessContractMethods>(ProcessContractDefinition.abi, ProcessContractDefinition.bytecode, { signer, wallet }, deployArguments)

    if (signer) {
        return instance.connect(signer) as IProcessContract
    }
    else { // if we reach this point, then wallet myst have been set
        if (!wallet.provider) wallet = wallet.connect(gw.provider)
        return instance.connect(wallet) as IProcessContract
    }
}

///////////////////////////////////////////////////////////////////////////////
// INSTANCE ATTACHMENT
///////////////////////////////////////////////////////////////////////////////

/**
 * Returns an Entity Resolver contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 * @param address (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function getEnsPublicResolverInstance(params: AttachToContractParams = {}, address: string = null): Promise<(IEnsPublicResolverContract)> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const gwProvider = gw.provider

    if (typeof address != "string") {
        address = await provider.resolveName(publicResolverEnsDomain)
        if (!address) throw new Error("The contract address can't be determined")
    }

    if (wallet) {
        if (!wallet.provider) wallet = wallet.connect(gwProvider)
        return gw.attach(address, EntityContractDefinition.abi as any).connect(wallet) as (IEnsPublicResolverContract)
    }
    else if (signer)
        return gw.attach(address, EntityContractDefinition.abi as any).connect(signer) as (IEnsPublicResolverContract)
    else
        return gw.attach(address, EntityContractDefinition.abi as any)
}

/**
 * Returns a Namespace contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 * @param address The address of the contract instance
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function getNamespaceInstance(params: AttachToContractParams = {}, address: string): Promise<(INamespaceContract)> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const gwProvider = gw.provider

    if (wallet) {
        if (!wallet.provider) wallet = wallet.connect(gwProvider)
        return gw.attach(address, NamespaceContractDefinition.abi as any).connect(wallet) as (INamespaceContract)
    }
    else if (signer)
        return gw.attach(address, NamespaceContractDefinition.abi as any).connect(signer) as (INamespaceContract)
    else
        return gw.attach(address, NamespaceContractDefinition.abi as any)
}

/**
 * Returns a Process contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer.
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway.
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key.
 * @param address (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
 *
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function getProcessInstance(params: AttachToContractParams = {}, address: string = null): Promise<(IProcessContract)> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const gwProvider = gw.provider

    if (typeof address != "string") {
        address = await provider.resolveName(processesEnsDomain)
        if (!address) throw new Error("The contract address can't be determined")
    }

    if (wallet) {
        if (!wallet.provider) wallet = wallet.connect(gwProvider)
        return gw.attach(address, ProcessContractDefinition.abi as any).connect(wallet) as (IProcessContract)
    }
    else if (signer)
        return gw.attach(address, ProcessContractDefinition.abi as any).connect(signer) as (IProcessContract)
    else
        return gw.attach(address, ProcessContractDefinition.abi as any)
}
