import { Contract, providers, Wallet, Signer } from "ethers"
import { Web3Gateway } from "./gateway"
import { entityResolverEnsDomain, votingProcessEnsDomain } from "../constants"
import {
    EntityResolver as EntityContractDefinition,
    VotingProcess as VotingContractDefinition,
    EntityResolverContractMethods,
    VotingProcessContractMethods,
} from "dvote-solidity"

type DeployContractParams = { gateway?: string, provider?: providers.Provider, signer?: Signer; wallet?: Wallet; }
type AttachToContractParams = { gateway?: string, provider?: providers.Provider, signer?: Signer; wallet?: Wallet; }

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
export async function deployEntityResolverContract(params: DeployContractParams = {}): Promise<Contract & EntityResolverContractMethods> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const instance = await gw.deploy<EntityResolverContractMethods>(EntityContractDefinition.abi, EntityContractDefinition.bytecode, { signer, wallet })

    if (signer) {
        return instance.connect(signer) as Contract & EntityResolverContractMethods
    }
    else { // if we reach this point, then wallet myst have been set
        if (!wallet.provider) wallet = wallet.connect(gw.getProvider())
        return instance.connect(wallet) as Contract & EntityResolverContractMethods
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
export async function deployVotingProcessContract(params: DeployContractParams = {}, deployArguments: [number]): Promise<Contract & VotingProcessContractMethods> {
    if (!deployArguments || !deployArguments.length) throw new Error("Invalid deploy arguments")
    else if (typeof deployArguments[0] != "number") throw new Error("Invalid Chain ID")

    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const instance = await gw.deploy<VotingProcessContractMethods>(VotingContractDefinition.abi, VotingContractDefinition.bytecode, { signer, wallet }, deployArguments)

    if (signer) {
        return instance.connect(signer) as Contract & VotingProcessContractMethods
    }
    else { // if we reach this point, then wallet myst have been set
        if (!wallet.provider) wallet = wallet.connect(gw.getProvider())
        return instance.connect(wallet) as Contract & VotingProcessContractMethods
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
export async function getEntityResolverInstance(params: AttachToContractParams = {}, address: string = null): Promise<(Contract & EntityResolverContractMethods)> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const gwProvider = gw.getProvider()

    if (typeof address != "string") {
        address = await provider.resolveName(entityResolverEnsDomain)
        if (!address) throw new Error("The contract address can't be determined")
    }

    if (wallet) {
        if (!wallet.provider) wallet = wallet.connect(gwProvider)
        return gw.attach(address, EntityContractDefinition.abi as any).connect(wallet) as (Contract & EntityResolverContractMethods)
    }
    else if (signer)
        return gw.attach(address, EntityContractDefinition.abi as any).connect(signer) as (Contract & EntityResolverContractMethods)
    else
        return gw.attach(address, EntityContractDefinition.abi as any)
}

/**
 * Returns a Voting Process contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer. 
 * - Use `gateway` (string) to define the URI of a Vocdoni Web3 Gateway. 
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key. 
 * @param address (optional) Overrides the address of the contract instance, instead of the value from `*.vocdoni.eth`
 * 
 * One of `gateway`/`provider` and `signer`/`wallet` is required
 */
export async function getVotingProcessInstance(params: AttachToContractParams = {}, address: string = null): Promise<(Contract & VotingProcessContractMethods)> {
    let { gateway, provider, signer, wallet } = params

    const gw = new Web3Gateway(gateway || provider)
    const gwProvider = gw.getProvider()

    if (typeof address != "string") {
        address = await provider.resolveName(votingProcessEnsDomain)
        if (!address) throw new Error("The contract address can't be determined")
    }

    if (wallet) {
        if (!wallet.provider) wallet = wallet.connect(gwProvider)
        return gw.attach(address, VotingContractDefinition.abi as any).connect(wallet) as (Contract & VotingProcessContractMethods)
    }
    else if (signer)
        return gw.attach(address, VotingContractDefinition.abi as any).connect(signer) as (Contract & VotingProcessContractMethods)
    else
        return gw.attach(address, VotingContractDefinition.abi as any)
}
