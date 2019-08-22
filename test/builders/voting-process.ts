import { deployVotingProcessContract } from "../../src/net/contracts"
import { VotingProcessContractMethods } from "dvote-solidity"
import { Contract } from "ethers"
import { getAccounts, TestAccount } from "../testing-eth-utils"
// import EntityBuilder from "./entity-resolver"
// import { BigNumber } from "ethers/utils"

// DEFAULT VALUES
export const DEFAULT_METADATA_CONTENT_HASHED_URI = "ipfs://ipfs/1234,https://server/uri!0987654321"
export const DEFAULT_MERKLE_ROOT = "0x123456789"
export const DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI = "ipfs://ipfs/1234,https://server/uri!1234567812345678"

// BUILDER
export default class VotingProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    metadata: string = DEFAULT_METADATA_CONTENT_HASHED_URI
    merkleRoot: string = DEFAULT_MERKLE_ROOT
    merkleTree: string = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
    chainId: number = 0

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(votingProcessessCount: number = 1): Promise<Contract & VotingProcessContractMethods> {
        const contractInstance = await deployVotingProcessContract({ provider: this.entityAccount.provider, wallet: this.entityAccount.wallet }, [this.chainId])

        // const blockNumber = await this.entityAccount.provider.getBlockNumber()
        // const currentBlock = await this.entityAccount.provider.getBlock(blockNumber)

        const processIds: string[] = []
        for (let i = 0; i < votingProcessessCount; i++) {
            let processId = await contractInstance.getProcessId(this.entityAccount.address, i)
            processIds.push(processId)

            await contractInstance.create(this.metadata, this.merkleRoot, this.merkleTree)
        }

        return contractInstance
    }

    // custom modifiers
    withEntityAccount(entityAccount: TestAccount) {
        if (!entityAccount) throw new Error("Empty entityAccount value")

        this.entityAccount = entityAccount
        return this
    }
    withMetadata(metadata: string) {
        if (!metadata) throw new Error("Empty metadata value")

        this.metadata = metadata
        return this
    }
    withChainId(chainId: number) {
        this.chainId = chainId
        return this
    }
}
