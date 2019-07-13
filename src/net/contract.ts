import { Contract, providers, Wallet, Signer } from "ethers"
import { Web3Gateway } from "../net/gateway"

import {
    EntityResolver as EntityContractDefinition,
    VotingProcess as VotingContractDefinition,
    EntityResolverContractMethods,
    VotingProcessContractMethods,
} from "dvote-solidity"

// DEPLOYMENT

/**
 * Deploy a contract and return the newly created instance of an Entity Resolver
 * @param gwParams Use `gatewayUri` to make use of a Vocdoni Gateway. Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * @param signParams Pass a `signer` if you are using Metamask. Pass a `wallet` if you want to sign locally with a private key. 
 */
export function deployEntityContract(gwParams: { gatewayUri?: string, provider?: providers.Provider } = {}, signParams: { signer?: Signer; wallet?: Wallet; } = {}): Promise<Contract & EntityResolverContractMethods> {
    const gw = new Web3Gateway(gwParams)
    return gw.deploy(EntityContractDefinition.abi, EntityContractDefinition.bytecode, signParams)
}

/**
 * Deploy a contract and return the newly created instance of a Voting Process
 * @param gwParams Use `gatewayUri` to make use of a Vocdoni Gateway. Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * @param signParams Pass a `signer` if you are using Metamask. Pass a `wallet` if you want to sign locally with a private key. 
 */
export function deployVotingContract(gwParams: { gatewayUri?: string, provider?: providers.Provider } = {}, signParams: { signer?: Signer; wallet?: Wallet; } = {}): Promise<Contract & VotingProcessContractMethods> {
    const gw = new Web3Gateway(gwParams)
    return gw.deploy(VotingContractDefinition.abi, VotingContractDefinition.bytecode, signParams)
}

// INSTANCE ATTACHMENT

/**
 * Returns an Entity Resolver contract instance, bound to the given Gateway/Provider
 * @param gwParams Use `gatewayUri` as a String to get a read-only gateway. Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * @param address 
 */
export function getEntityResolverInstance(gwParams: { gatewayUri?: string, provider?: providers.Provider } = {}, address: string): (Contract & EntityResolverContractMethods) {
    const gw = new Web3Gateway(gwParams)
    return gw.attach(address, EntityContractDefinition.abi)
}

/**
 * Returns a Voting Process contract instance, bound to the given Gateway/Provider
 * @param gwParams Use `gatewayUri` as a String to get a read-only gateway. Pass an Ethers.js `provider` connected to a wallet to sign transactions.
 * @param address 
 */
export function getVotingContractInstance(gwParams: { gatewayUri?: string, provider?: providers.Provider } = {}, address: string): (Contract & VotingProcessContractMethods) {
    const gw = new Web3Gateway(gwParams)
    return gw.attach(address, VotingContractDefinition.abi)
}
