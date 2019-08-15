import { deployVotingContract } from "../../src/api/vote"
import { VotingProcessContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { getAccounts, TestAccount } from "../eth-util"
// import EntityBuilder from "./entity-resolver"
// import { BigNumber } from "ethers/utils"

// DEFAULT VALUES
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "bzz://1234,ipfs://ipfs/1234!0987654321"

// BUILDER
export default class VotingProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    metadataContentHashedUri: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    chainId: number = 0

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(votingProcessessCount: number = 1): Promise<Contract & VotingProcessContractMethods> {
        const contractInstance = await deployVotingContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet }, [this.chainId])

        // const blockNumber = await this.entityAccount.provider.getBlockNumber()
        // const currentBlock = await this.entityAccount.provider.getBlock(blockNumber)

        const processIds: string[] = []
        for (let i = 0; i < votingProcessessCount; i++) {
            let processId = await contractInstance.getProcessId(this.entityAccount.address, i)
            processIds.push(processId)

            await contractInstance.create(this.metadataContentHashedUri)
        }

        return contractInstance
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        if (!entityAccount) throw new Error("Empty entityAccount value")

        this.entityAccount = entityAccount
        return this
    }
    withMetadataContentHashedUri(metadataContentHashedUri: string) {
        if (!metadataContentHashedUri) throw new Error("Empty metadataContentHashedUri value")

        this.metadataContentHashedUri = metadataContentHashedUri
        return this
    }
    withChainId(chainId: number) {
        this.chainId = chainId
        return this
    }
}

