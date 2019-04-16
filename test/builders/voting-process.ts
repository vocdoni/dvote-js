import VotingProcess from "../../src/dvote/voting-process"
import { Contract } from "ethers"
import { VotingProcessInstance } from "dvote-solidity"
import { getAccounts, TestAccount } from "../eth-util"
import EntityBuilder from "./entity-resolver"

// DEFAULT VALUES
export const DEFAULT_NAME = "Voting Process name"
export const DEFAULT_METADATA_CONTENT_URI = "bzz://1234,ipfs://ipfs/1234"
export const DEFAULT_START_TIME_PADDING = 20
export const DEFAULT_END_TIME_PADDING = 40
export const DEFAULT_VOTING_PUBLIC_KEY = "0x012345678901234567890123456789012345678901234567890123"
export const DEFAULT_RELAY_PUBLIC_KEY = "0x01234"
export const DEFAULT_RELAY_MESSAGING_URI = "pss://0x1234@topic"

// BUILDER
export default class VotingProcessBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    entityResolver: string
    name: string = DEFAULT_NAME
    metadataContentUri: string = DEFAULT_METADATA_CONTENT_URI
    votingPublicKey: string = DEFAULT_VOTING_PUBLIC_KEY
    relays: ({ address: string, publicKey: string, messagingUri: string })[] = []

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(votingProcessessCount: number = 1): Promise<VotingProcessInstance | Contract> {
        const factory = new VotingProcess({
            provider: this.entityAccount.provider,
            privateKey: this.entityAccount.privateKey
        })
        const contractInstance: (VotingProcessInstance | Contract) = await factory.deploy()

        if (!this.entityResolver) {
            const entityBuilder = new EntityBuilder().withEntityAccount(this.entityAccount)
            const resolver = await entityBuilder.build()
            this.entityResolver = resolver.address
        }

        const blockNumber = await this.entityAccount.provider.getBlockNumber()
        const currentBlock = await this.entityAccount.provider.getBlock(blockNumber)

        const processIds: string[] = []
        for (let i = 0; i < votingProcessessCount; i++) {
            let processId = VotingProcess.getProcessId(this.entityAccount.address, i)
            processIds.push(processId)

            await contractInstance.create(
                this.entityResolver,
                this.name,
                this.metadataContentUri,
                currentBlock.timestamp + DEFAULT_START_TIME_PADDING,
                currentBlock.timestamp + DEFAULT_END_TIME_PADDING,
                this.votingPublicKey
            )

            for (let relay of this.relays) {
                await contractInstance.addRelay(processId, relay.address, relay.publicKey, relay.messagingUri)
            }
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
    withMetadataContentUri(metadataContentUri: string) {
        this.metadataContentUri = metadataContentUri
        return this
    }
    withVotingPublicKey(votingPublicKey: string) {
        this.votingPublicKey = votingPublicKey
        return this
    }
    withRelay(address: string, publicKey: string = DEFAULT_RELAY_PUBLIC_KEY, messagingUri: string = DEFAULT_RELAY_MESSAGING_URI) {
        this.relays.push({
            address,
            publicKey,
            messagingUri
        })
        return this
    }
}
