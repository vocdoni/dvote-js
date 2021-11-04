// NOTE: This code is borrowed from dvote-solidity

import { Erc20StorageProofContractMethods, Erc20StorageProofContractDefinition } from "../../packages/net/src" // TODO: Import from the new NPM package
import { Contract } from "ethers"
import { TestAccount } from "../helpers/all-services"
import { Web3Gateway } from "../../packages/net/src" // TODO: Import from the new NPM package


// BUILDER
export default class StorageProofsBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & Erc20StorageProofContractMethods> {
        const deployAccount = this.accounts[0]
        const gw = new Web3Gateway(deployAccount.provider)
        const contractInstance = await gw.deploy<Erc20StorageProofContractMethods>(Erc20StorageProofContractDefinition.abi, Erc20StorageProofContractDefinition.bytecode, { wallet: deployAccount.wallet })

        return contractInstance.connect(this.entityAccount.wallet) as Contract & Erc20StorageProofContractMethods
    }
}
