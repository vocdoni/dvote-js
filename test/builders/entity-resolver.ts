import { ensHashAddress } from "dvote-solidity"
import { deployEnsPublicResolverContract } from "../../src/net/contracts"
// import { TextRecordKeys } from "../../src/models/entity"
import { EnsPublicResolverContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { TestAccount } from "../helpers/all-services"

// DEFAULT VALUES
export const DEFAULT_NAME = "Entity Name"

// BUILDER
export default class EntityResolverBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EnsPublicResolverContractMethods & Contract> {
        const contractInstance = await deployEnsPublicResolverContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet })

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
