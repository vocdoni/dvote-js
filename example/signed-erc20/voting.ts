import * as Bluebird from "bluebird"
import * as assert from "assert"
import { INewProcessParams, ProcessMetadata, ProcessMetadataTemplate } from "@vocdoni/data-models"
import { ProcessState, VochainWaiter, VotingApi } from "@vocdoni/voting"
import {
    ProcessCensusOrigin,
    ProcessEnvelopeType,
    ProcessMode,
} from "@vocdoni/contract-wrappers"
import { getConfig } from "./config"
import { TestAccount } from "./census"
import { getChoicesForVoter, waitUntilPresent } from "./util"
import { CensusErc20Api } from "@vocdoni/census"
import { Wallet } from "@ethersproject/wallet"
import { JsonRpcProvider } from "@ethersproject/providers"
import { Erc20TokensApi, IGatewayClient } from "@vocdoni/client"

const config = getConfig()

export async function launchNewVote(creatorWallet: Wallet, gwPool: IGatewayClient) {

    // TOKEN CONTRACT

    if (!await Erc20TokensApi.isRegistered(config.tokenAddress, gwPool)) {
        await CensusErc20Api.registerTokenAuto(
            config.tokenAddress,
            creatorWallet,
            gwPool
        )

        assert(await Erc20TokensApi.isRegistered(config.tokenAddress, gwPool))
    }

    const tokenInfo = await CensusErc20Api.getTokenInfo(config.tokenAddress, gwPool)

    const blockNumber = (await gwPool.provider.getBlockNumber()) - 1
    const proof = await CensusErc20Api.generateProof(config.tokenAddress, creatorWallet.address, tokenInfo.balanceMappingPosition, blockNumber, gwPool.provider as JsonRpcProvider)

    // METADATA

    console.log("Preparing the new vote metadata")

    const processMetadataPre: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
    processMetadataPre.title.default = "E2E process"
    processMetadataPre.description.default = "E2E process"
    processMetadataPre.questions = [
        {
            title: { default: "The title of the first question" },
            description: { default: "The description of the first question" },
            choices: [
                { title: { default: "Yes" }, value: 0 },
                { title: { default: "No" }, value: 1 },
            ]
        }
    ]
    const maxValue = processMetadataPre.questions.reduce((prev, cur) => {
        const localMax = cur.choices.reduce((prev, cur) => prev > cur.value ? prev : cur.value, 0)
        return localMax > prev ? localMax : prev
    }, 0)

    // BLOCK

    console.log("Getting the block height")
    const currentBlock = await VotingApi.getBlockHeight(gwPool)
    const startBlock = currentBlock + 15
    const blockCount = 6 * 4 // 4m

    const processParams: INewProcessParams = {
        mode: ProcessMode.make({ autoStart: true }),
        envelopeType: ProcessEnvelopeType.make({}), // bit mask
        censusOrigin: ProcessCensusOrigin.ERC20,
        metadata: processMetadataPre,
        censusRoot: proof.storageHash,
        startBlock,
        blockCount,
        maxCount: 1,
        maxValue,
        maxTotalCost: 0,
        costExponent: 10000,  // 1.0000
        maxVoteOverwrites: 1,
        sourceBlockHeight: blockNumber,
        tokenAddress: config.tokenAddress,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    console.log("Creating the process")
    const processId = await VotingApi.newProcess(processParams, creatorWallet, gwPool)
    assert(processId)

    await waitUntilPresent(processId, gwPool)

    // Reading back
    const processState = await VotingApi.getProcessState(processId, gwPool)
    assert.strictEqual(processState.entityId.toLowerCase(), config.tokenAddress.toLowerCase())
    assert.strictEqual(processState.startBlock, processParams.startBlock, "SENT " + JSON.stringify(processParams) + " GOT " + JSON.stringify(processParams))
    assert.strictEqual(processState.endBlock, processState.startBlock + processParams.blockCount)

    const processMetadata = await VotingApi.getProcessMetadata(processId, gwPool)

    return { processId, processState, processMetadata }
}

export async function submitVotes(processId: string, processParams: ProcessState, processMetadata: ProcessMetadata, accounts: TestAccount[], gwPool: IGatewayClient) {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.encryptedVotes ? await VotingApi.getProcessKeys(processId, gwPool) : null
    const balanceMappingPosition = (await CensusErc20Api.getTokenInfo(config.tokenAddress, gwPool)).balanceMappingPosition

    await Bluebird.map(accounts, async (account: TestAccount, idx: number) => {

        // VOTER
        const wallet = new Wallet(account.privateKey)

        const result = await CensusErc20Api.generateProof(config.tokenAddress, wallet.address, balanceMappingPosition, processParams.sourceBlockHeight, gwPool.provider as JsonRpcProvider)

        const choices = getChoicesForVoter(processMetadata.questions.length, idx)
        const censusProof = result.storageProof[0]

        const envelope = processParams.envelopeType.encryptedVotes ?
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet })

        await VotingApi.submitEnvelope(envelope, wallet, gwPool)

        // wait a bit
        await new Promise(resolve => setTimeout(resolve, 11000))

        const nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
        const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, gwPool)

        if (config.stopOnError) assert(registered)
    }, { concurrency: 100 })

    console.log()
}

export async function checkVoteResults(processId: string, gwPool: IGatewayClient) {
    assert.strictEqual(typeof processId, "string")

    if (config.encryptedVote) {
        console.log("Waiting a bit for the votes to be received", processId)
        const nextBlock = 2 + await VotingApi.getBlockHeight(gwPool)
        await VochainWaiter.waitUntil(nextBlock, gwPool, { verbose: true })

        console.log("Fetching the number of votes for", processId)
        const envelopeHeight = await VotingApi.getEnvelopeHeight(processId, gwPool)
        assert.strictEqual(envelopeHeight, config.privKeys.length)

        const processState = await VotingApi.getProcessState(processId, gwPool)

        console.log("Waiting for the process to end", processId)
        await VochainWaiter.waitUntil(processState.endBlock, gwPool, { verbose: true })
    }

    console.log("Waiting a bit for the results to be ready", processId)
    await VochainWaiter.wait(2, gwPool, { verbose: true })

    console.log("Fetching the vote results for", processId)
    const rawResults = await VotingApi.getResults(processId, gwPool)
    const totalVotes = await VotingApi.getEnvelopeHeight(processId, gwPool)

    assert.strictEqual(rawResults.results.length, 1)
    assert(rawResults.results[0])

    switch (config.votesPattern) {
        case "all-0":
            assert(rawResults.results[0].length >= 2)
            assert.strictEqual(rawResults.results[0][0], config.privKeys.length)
            assert.strictEqual(rawResults.results[0][1], 0)
            break
        case "all-1":
            assert(rawResults.results[0].length >= 2)
            assert.strictEqual(rawResults.results[0][0], 0)
            assert.strictEqual(rawResults.results[0][1], config.privKeys.length)
            break
        case "all-2":
            assert(rawResults.results[0].length >= 3)
            assert.strictEqual(rawResults.results[0][0], 0)
            assert.strictEqual(rawResults.results[0][1], 0)
            assert.strictEqual(rawResults.results[0][2], config.privKeys.length)
            break
        case "all-even":
            assert(rawResults.results[0].length >= 2)
            if (config.privKeys.length % 2 == 0) {
                assert.strictEqual(rawResults.results[0][0], config.privKeys.length / 2)
                assert.strictEqual(rawResults.results[0][1], config.privKeys.length / 2)
            }
            else {
                assert.strictEqual(rawResults.results[0][0], Math.ceil(config.privKeys.length / 2))
                assert.strictEqual(rawResults.results[0][1], Math.floor(config.privKeys.length / 2))
            }
            break
        case "incremental":
            assert.strictEqual(rawResults.results[0].length, 2)
            rawResults.results.forEach((question, i) => {
                for (let j = 0; j < question.length; j++) {
                    if (i == j) assert.strictEqual(question[j], config.privKeys.length)
                    else assert.strictEqual(question[j], 0)
                }
            })
            break
        default:
            throw new Error("The type of votes is unknown")
    }

    assert.strictEqual(totalVotes, config.privKeys.length)
}
