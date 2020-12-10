// NOTE: This code is borrowed from dvote-solidity

import { TokenStorageProofContractMethods, TokenStorageProofContractDefinition } from "../../src/net/contracts"
import { Contract } from "ethers"
import { TestAccount } from "../helpers/all-services"
import { Web3Gateway } from "../../src/net/gateway-web3"


// BUILDER
export default class StorageProofsBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & TokenStorageProofContractMethods> {
        const deployAccount = this.accounts[0]
        const gw = new Web3Gateway(deployAccount.provider)
        const contractInstance = await gw.deploy<TokenStorageProofContractMethods>(TokenStorageProofContractDefinition.abi, TokenStorageProofContractDefinition.bytecode, { wallet: deployAccount.wallet })

        return contractInstance.connect(this.entityAccount.wallet) as Contract & TokenStorageProofContractMethods
    }
}
