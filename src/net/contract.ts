import { Contract, providers, Wallet, Signer } from "ethers"
import { Web3Gateway } from "../net/gateway"

import { EntityResolver as EntityContractDefinition, VotingProcess as VotingContractDefinition } from "dvote-solidity"

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



///////////////////////////////////////////////////////////////////////////////
// Contract method typings
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an Entity Resolver contract */
type EntityResolverContractMethods = {
    /**
     * Returns the text associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(entityId: string, key: string): Promise<string>
    /**
     * Returns the list associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @return The list array of values.
     */
    list(entityId: string, key: string): Promise<string[]>
    /**
     * Returns the text associated with an ENS node, key and index.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @param index The index within the list to retrieve.
     * @return The list entry's text value.
     */
    listText(entityId: string, key: string, index: number): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(entityId: string, key: string, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Sets the text of the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index of the list to set.
     * @param value The text to store.
     */
    setListText(entityId: string, key: string, index: number, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Appends a new value on the given ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param value The text to store.
     */
    pushListText(entityId: string, key: string, value: string): Promise<{ wait: () => Promise<any> }>
    /**
     * Removes the value on the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * Note: This may cause items to be arranged in a different order.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index to remove.
     */
    removeListIndex(entityId: string, key: string, index: number): Promise<{ wait: () => Promise<any> }>
}

/** Custom Smart Contract operations for a Voting Process contract */
type VotingProcessContractMethods = {
    // TODO: Add the typings from
    // https://github.com/vocdoni/dvote-solidity/blob/master/contracts/VotingProcess.sol
}
