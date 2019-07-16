import { Contract, providers, Wallet, Signer } from "ethers"
import { Web3Gateway } from "../net/gateway"

import {
    EntityResolver as EntityContractDefinition,
    VotingProcess as VotingContractDefinition,
    EntityResolverContractMethods,
    VotingProcessContractMethods,
} from "dvote-solidity"

type DeployContractParams = { gatewayUri?: string, provider?: providers.Provider, signer?: Signer; wallet?: Wallet; }
type AttachToContractParams = { gatewayUri?: string, provider?: providers.Provider, signer?: Signer; wallet?: Wallet; }

// DEPLOYMENT

/**
 * Deploy a contract and return the newly created instance of an Entity Resolver
 * @param params An object accepting different keys to set the provider and signer. 
 * - Use `gatewayUri` (string) to make use of a Vocdoni Gateway. 
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key. 
 * 
 * One of `gatewayUri`/`provider` and `signer`/`wallet` is required
 */
export async function deployEntityContract(params: DeployContractParams = {}): Promise<Contract & EntityResolverContractMethods> {
    const gwParams = { gatewayUri: params.gatewayUri, provider: params.provider }
    const signParams = { signer: params.signer, wallet: params.wallet }

    const gw = new Web3Gateway(gwParams)
    const instance = await gw.deploy<EntityResolverContractMethods>(EntityContractDefinition.abi, EntityContractDefinition.bytecode, signParams)

    if (params.signer) {
        return instance.connect(params.signer) as Contract & EntityResolverContractMethods
    }
    else { // if we reach this point, then wallet myst have been set
        return instance.connect(params.wallet) as Contract & EntityResolverContractMethods
    }
}

/**
 * Deploy a contract and return the newly created instance of a Voting Process
 * @param params An object accepting different keys to set the provider and signer. 
 * - Use `gatewayUri` (string) to make use of a Vocdoni Gateway. 
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key. 
 * 
 * One of `gatewayUri`/`provider` and `signer`/`wallet` is required
 */
export async function deployVotingContract(params: DeployContractParams = {}): Promise<Contract & VotingProcessContractMethods> {
    const gwParams = { gatewayUri: params.gatewayUri, provider: params.provider }
    const signParams = { signer: params.signer, wallet: params.wallet }

    const gw = new Web3Gateway(gwParams)
    const instance = await gw.deploy<VotingProcessContractMethods>(VotingContractDefinition.abi, VotingContractDefinition.bytecode, signParams)

    if (params.signer) {
        return instance.connect(params.signer) as Contract & VotingProcessContractMethods
    }
    else { // if we reach this point, then wallet myst have been set
        return instance.connect(params.wallet) as Contract & VotingProcessContractMethods
    }
}

// INSTANCE ATTACHMENT

/**
 * Returns an Entity Resolver contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer. 
 * - Use `gatewayUri` (string) to make use of a Vocdoni Gateway. 
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key. 
 * @param address Address of the contract instance
 * 
 * One of `gatewayUri`/`provider` and `signer`/`wallet` is required
 */
export function getEntityResolverInstance(params: AttachToContractParams = {}, address: string): (Contract & EntityResolverContractMethods) {
    const gwParams = { gatewayUri: params.gatewayUri, provider: params.provider }
    const { signer, wallet } = params

    const gw = new Web3Gateway(gwParams)
    if (wallet)
        return gw.attach(address, EntityContractDefinition.abi).connect(wallet) as (Contract & EntityResolverContractMethods)
    else if (signer)
        return gw.attach(address, EntityContractDefinition.abi).connect(signer) as (Contract & EntityResolverContractMethods)
    else
        return gw.attach(address, EntityContractDefinition.abi)
}

/**
 * Returns a Voting Process contract instance, bound to the given Gateway/Provider
 * @param params An object accepting different keys to set the provider and signer. 
 * - Use `gatewayUri` (string) to make use of a Vocdoni Gateway. 
 * - Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * - Pass an Ethers.js `signer` if you are using Metamask.
 * - Pass an Ethers.js `wallet` if you want to sign locally with a private key. 
 * @param address Address of the contract instance
 * 
 * One of `gatewayUri`/`provider` and `signer`/`wallet` is required
 */
export function getVotingContractInstance(params: AttachToContractParams = {}, address: string): (Contract & VotingProcessContractMethods) {
    const gwParams = { gatewayUri: params.gatewayUri, provider: params.provider }
    const { signer, wallet } = params

    const gw = new Web3Gateway(gwParams)
    if (wallet)
        return gw.attach(address, VotingContractDefinition.abi).connect(wallet) as (Contract & VotingProcessContractMethods)
    else if (signer)
        return gw.attach(address, VotingContractDefinition.abi).connect(signer) as (Contract & VotingProcessContractMethods)
    else
        return gw.attach(address, VotingContractDefinition.abi)
}
