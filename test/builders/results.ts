// NOTE: This code is borrowed from dvote-solidity

import { ResultsContractMethods, ResultsContractDefinition } from "../../src/net/contracts"
import { Contract, ContractFactory } from "ethers"
import { TestAccount } from "../helpers/all-services"
import GenesisBuilder from "./genesis"

// BUILDER
export default class ResultsBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    genesisAddress: string

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }
    async build(): Promise<Contract & ResultsContractMethods> {
        if (!this.genesisAddress) {
            // Deploy one
            const genesisInstance = await new GenesisBuilder(this.accounts).build()
            this.genesisAddress = genesisInstance.address
        }

        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(ResultsContractDefinition.abi, ResultsContractDefinition.bytecode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy(this.genesisAddress) as Contract & ResultsContractMethods

        return contractInstance.connect(this.entityAccount.wallet) as Contract & ResultsContractMethods
    }

    withGenesisAddress(genesisAddr: string) {
        this.genesisAddress = genesisAddr

        return this
    }
}
