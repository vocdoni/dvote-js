// NOTE: This code is borrowed from dvote-solidity


import {
    NamespacesContractMethods,
    NamespacesContractDefinition
} from "vocdoni-contracts" // TODO: Import from the new NPM package
import { Contract, ContractFactory } from "ethers"
import { TestAccount } from "../helpers/all-services"

export const DEFAULT_NAMESPACE = 1  // The id that the first process contract will be assigned to

// BUILDER
export default class NamespaceBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & NamespacesContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(NamespacesContractDefinition.abi, NamespacesContractDefinition.bytecode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & NamespacesContractMethods

        return contractInstance.connect(this.entityAccount.wallet) as Contract & NamespacesContractMethods
    }
}
