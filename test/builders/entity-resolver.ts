import { getEntityId, deployEntityResolverContract } from "../../src/api/entity"
// import { TextRecordKeys } from "../../src/models/entity"
import { EntityResolverContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { getAccounts, TestAccount } from "../eth-util"

// DEFAULT VALUES
export const DEFAULT_NAME = "Organizer Entity Name"

// BUILDER
export default class EntityBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EntityResolverContractMethods & Contract> {
        const contractInstance = await deployEntityResolverContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet })

        const entityId = getEntityId(this.entityAccount.address)

        await contractInstance.setText(entityId, "key-name", this.name)

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
