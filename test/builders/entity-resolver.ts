import { ensHashAddress } from "dvote-solidity"
import { deployEntityResolverContract } from "../../src/net/contracts"
// import { TextRecordKeys } from "../../src/models/entity"
import { EnsPublicResolverContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { getAccounts, TestAccount } from "../helpers/all-services"

// DEFAULT VALUES
export const DEFAULT_NAME = "Entity Name"

// BUILDER
export default class EntityBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EnsPublicResolverContractMethods & Contract> {
        const contractInstance = await deployEntityResolverContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet })

        const entityNode = ensHashAddress(this.entityAccount.address)

        await contractInstance.setText(entityNode, "key-name", this.name)

        return contractInstance
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        this.entityAccount = entityAccount
        return this
    }
    withName(name: string) {
        this.name = name
        return this
    }
}
