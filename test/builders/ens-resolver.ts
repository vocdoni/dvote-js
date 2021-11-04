import { ensHashAddress, EnsResolverContractMethods, PublicResolverContractDefinition } from "../../packages/net/src" // TODO: Import from the new NPM package
// import { TextRecordKeys } from "../../src/models/entity"
import { Contract } from "ethers"
import { TestAccount } from "../helpers/all-services"
import { Web3Gateway } from "../../packages/net/src" // TODO: Import from the new NPM package

// DEFAULT VALUES
export const DEFAULT_NAME = "Entity Name"

const nullAddress = "0x0000000000000000000000000000000000000000"

// BUILDER
export default class EntityResolverBuilder {
    accounts: TestAccount[]
    entityAccount: TestAccount

    name: string = DEFAULT_NAME

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<EnsResolverContractMethods & Contract> {
        const gw = new Web3Gateway(this.entityAccount.provider)
        const newInstnace = await gw.deploy<EnsResolverContractMethods>(PublicResolverContractDefinition.abi, PublicResolverContractDefinition.bytecode, { wallet: this.entityAccount.wallet }, [nullAddress])

        const contractInstance = await gw.getEnsPublicResolverInstance(this.entityAccount.wallet, newInstnace.address)
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
