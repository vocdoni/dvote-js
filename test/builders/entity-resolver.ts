import EntityResolver, { TextRecordKeys } from "../../src/dvote/entity-resolver"
import { Contract } from "ethers"
import { EntityResolverInstance } from "dvote-solidity"
import { getAccounts, TestAccount } from "../eth-util"

// DEFAULT VALUES
export const DEFAULT_NAME = "Organizer Entity Name"

// BUILDER
export default class EntityBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME
    // relays: any[]

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EntityResolverInstance | Contract> {
        const factory = new EntityResolver({
            provider: this.entityAccount.provider,
            privateKey: this.entityAccount.privateKey
        })
        const contractInstance = await factory.deploy()

        const entityId = EntityResolver.getEntityId(this.entityAccount.address)

        await contractInstance.setText(entityId, TextRecordKeys.NAME, this.name)

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
