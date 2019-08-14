import { deployVotingContract, getProcessId } from "../../src/api/vote"
import { VotingProcessContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { getAccounts, TestAccount } from "../eth-util"
import EntityBuilder from "./entity-resolver"
// import { BigNumber } from "ethers/utils"

// DEFAULT VALUES
export const DEFAULT_NAME = "Voting Process name"
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "bzz://1234,ipfs://ipfs/1234!0987654321"
export const DEFAULT_START_TIME_PADDING = 20
export const DEFAULT_END_TIME_PADDING = 40
export const DEFAULT_VOTING_PUBLIC_KEY = "0x012345678901234567890123456789012345678901234567890123"

// BUILDER
export default class VotingProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    entityResolver: string
    name: string = DEFAULT_NAME
    metadataContentHashedUri: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    votingPublicKey: string = DEFAULT_VOTING_PUBLIC_KEY

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(votingProcessessCount: number = 1): Promise<Contract & VotingProcessContractMethods> {
        const contractInstance = await deployVotingContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet })

        if (!this.entityResolver) {
            const entityBuilder = new EntityBuilder().withEntityAccount(this.entityAccount)
            const resolver = await entityBuilder.build()
            this.entityResolver = resolver.address
        }

        const blockNumber = await this.entityAccount.provider.getBlockNumber()
        // const currentBlock = await this.entityAccount.provider.getBlock(blockNumber)

        const processIds: string[] = []
        for (let i = 0; i < votingProcessessCount; i++) {
            let processId = getProcessId(this.entityAccount.address, i)
            processIds.push(processId)

            await contractInstance.create(this.metadataContentHashedUri)
        }

        return contractInstance
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        this.entityAccount = entityAccount
        return this
    }
    withEntityResolver(entityResolver: string) {
        this.entityResolver = entityResolver
        return this
    }
    withName(name: string) {
        this.name = name
        return this
    }
    withMetadataContentHashedUri(metadataContentHashedUri: string) {
        this.metadataContentHashedUri = metadataContentHashedUri
        return this
    }
    withVotingPublicKey(votingPublicKey: string) {
        this.votingPublicKey = votingPublicKey
        return this
    }
}
