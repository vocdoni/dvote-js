import * as Bluebird from "bluebird"
import * as assert from "assert"
import { INewProcessParams, ProcessMetadata, ProcessMetadataTemplate } from "@vocdoni/data-models"
import { EthWaiter, VochainWaiter, VotingApi } from "@vocdoni/voting"
import {
  ProcessCensusOrigin,
  ProcessContractParameters,
  ProcessEnvelopeType,
  ProcessMode,
  ProcessStatus
} from "@vocdoni/contract-wrappers"
import { getConfig } from "./config"
import { TestAccount } from "./census"
import { getChoicesForVoter } from "./util"
import { CensusOffChainApi } from "@vocdoni/census"
import { Wallet } from "@ethersproject/wallet"
import { IGatewayClient } from "@vocdoni/client"

const config = getConfig()

export async function launchNewVote(censusRoot: string, censusUri: string, entityWallet: Wallet, gwPool: IGatewayClient) {
  assert(censusRoot)
  assert(censusUri)
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

  console.log("Getting the block height")
  const currentBlock = await VotingApi.getBlockHeight(gwPool)
  const startBlock = currentBlock + 25
  const blockCount = 60480

  const processParamsPre: INewProcessParams = {
    mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
    envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES, // bit mask
    censusOrigin: ProcessCensusOrigin.OFF_CHAIN_TREE,
    metadata: ProcessMetadataTemplate,
    censusRoot: censusRoot,
    censusUri: "ipfs://1234123412341234",
    startBlock,
    blockCount,
    maxCount: 1,
    maxValue,
    maxTotalCost: 0,
    costExponent: 10000,  // 1.0000
    maxVoteOverwrites: 1,
    paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
  }

  console.log("Creating the process")
  const processId = await VotingApi.newProcess(processParamsPre, entityWallet, gwPool)
  assert(processId)

  // Reading back
  const processParams = await VotingApi.getProcessContractParameters(processId, gwPool)
  assert.strictEqual(processParams.entityAddress.toLowerCase(), entityWallet.address.toLowerCase())
  assert.strictEqual(processParams.startBlock, processParamsPre.startBlock, "SENT " + JSON.stringify(processParamsPre) + " GOT " + JSON.stringify(processParams))
  assert.strictEqual(processParams.blockCount, processParamsPre.blockCount)
  assert.strictEqual(processParams.censusRoot, processParamsPre.censusRoot)
  assert.strictEqual(processParams.censusUri, processParamsPre.censusUri)

  const processMetadata = await VotingApi.getProcessMetadata(processId, gwPool)

  return { processId, processParams, processMetadata }
}

export async function submitVotes(processId: string, processParams: ProcessContractParameters, processMetadata: ProcessMetadata, accounts: TestAccount[], gwPool: IGatewayClient) {
  console.log("Launching votes")

  const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, gwPool) : null

  await Bluebird.map(accounts, async (account: TestAccount, idx: number) => {

    // VOTER
    const wallet = new Wallet(account.privateKey)

    const censusProof = await CensusOffChainApi.generateProof(processParams.censusRoot, { key: account.publicKeyEncoded }, true, gwPool)

    const choices = getChoicesForVoter(processMetadata.questions.length, idx)

    const envelope = processParams.envelopeType.hasEncryptedVotes ?
      await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet, processKeys }) :
      await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet })

    await VotingApi.submitEnvelope(envelope, wallet, gwPool)

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 11000))

    // Check
    const nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
    const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, gwPool)

    if (config.stopOnError) assert(registered)
  }, { concurrency: config.maxConcurrency })

  console.log()
}

export async function checkVoteResults(processId: string, processParams: ProcessContractParameters, entityWallet: Wallet, gwPool: IGatewayClient) {
  assert.strictEqual(typeof processId, "string")

  if (config.encryptedVote) {
    console.log("Waiting a bit for the votes to be received", processId)
    const nextBlock = 2 + await VotingApi.getBlockHeight(gwPool)
    await VochainWaiter.waitUntil(nextBlock, gwPool, { verbose: true })

    console.log("Fetching the number of votes for", processId)
    const envelopeHeight = await VotingApi.getEnvelopeHeight(processId, gwPool)
    assert.strictEqual(envelopeHeight, config.numAccounts)

    processParams = await VotingApi.getProcessContractParameters(processId, gwPool)

    if (!processParams.status.isEnded) {
      console.log("Ending the process", processId)
      await VotingApi.setStatus(processId, ProcessStatus.ENDED, entityWallet, gwPool)

      console.log("Waiting a bit for the votes to be decrypted", processId)
      await EthWaiter.wait(12, gwPool, { verbose: true })
    }
  }
  console.log("Waiting a bit for the results to be ready", processId)
  const nextBlock = 3 + await VotingApi.getBlockHeight(gwPool)
  await VochainWaiter.waitUntil(nextBlock, gwPool, { verbose: true })

  console.log("Fetching the vote results for", processId)
  const rawResults = await VotingApi.getResults(processId, gwPool)
  const totalVotes = await VotingApi.getEnvelopeHeight(processId, gwPool)

  assert.strictEqual(rawResults.results.length, 1)
  assert(rawResults.results[0])

  switch (config.votesPattern) {
    case "all-0":
      assert(rawResults.results[0].length >= 2)
      assert.strictEqual(rawResults.results[0][0], config.numAccounts + "000000000000000000")
      assert.strictEqual(rawResults.results[0][1], "0")
      break
    case "all-1":
      assert(rawResults.results[0].length >= 2)
      assert.strictEqual(rawResults.results[0][0], "0")
      assert.strictEqual(rawResults.results[0][1], config.numAccounts + "000000000000000000")
      break
    case "all-2":
      assert(rawResults.results[0].length >= 3)
      assert.strictEqual(rawResults.results[0][0], "0")
      assert.strictEqual(rawResults.results[0][1], "0")
      assert.strictEqual(rawResults.results[0][2], config.numAccounts + "000000000000000000")
      break
    case "all-even":
      assert(rawResults.results[0].length >= 2)
      if (config.numAccounts % 2 == 0) {
        assert.strictEqual(rawResults.results[0][0], (config.numAccounts / 2) + "000000000000000000")
        assert.strictEqual(rawResults.results[0][1], (config.numAccounts / 2) + "000000000000000000")
      }
      else {
        assert.strictEqual(rawResults.results[0][0], Math.ceil((config.numAccounts / 2)) + "000000000000000000")
        assert.strictEqual(rawResults.results[0][1], Math.floor((config.numAccounts / 2)) + "000000000000000000")
      }
      break
    case "incremental":
      assert.strictEqual(rawResults.results[0].length, 2)
      rawResults.results.forEach((question, i) => {
        for (let j = 0; j < question.length; j++) {
          if (i == j) assert.strictEqual(question[j], config.numAccounts)
          else assert.strictEqual(question[j], 0)
        }
      })
      break
    default:
      throw new Error("The type of votes is unknown")
  }

  assert.strictEqual(totalVotes, config.numAccounts)
}
