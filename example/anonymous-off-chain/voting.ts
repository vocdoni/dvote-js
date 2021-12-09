import * as Bluebird from "bluebird"
import * as assert from "assert"
import { INewProcessParams, ProcessMetadata, ProcessMetadataTemplate } from "@vocdoni/data-models"
import { AnonymousEnvelopeParams, EthWaiter, VochainWaiter, Voting, VotingApi, ProcessState } from "@vocdoni/voting"
import {
  ProcessCensusOrigin,
  ProcessContractParameters,
  ProcessEnvelopeType,
  ProcessMode,
  ProcessStatus
} from "@vocdoni/contract-wrappers"
import { getConfig } from "./config"
import { TestAccount } from "./census"
import { getChoicesForVoter, waitUntilPresent } from "./util"
import { CensusOffChainApi, CensusOnChainApi, ZkInputs, ZkSnarks } from "@vocdoni/census"
import { Wallet } from "@ethersproject/wallet"
import { IGatewayClient } from "@vocdoni/client"
import { Random } from "@vocdoni/common"
import { Poseidon } from "@vocdoni/hashing"

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
  const startBlock = currentBlock + 15
  const blockCount = 60480

  const processParamsPre: INewProcessParams = {
    mode: ProcessMode.make({ autoStart: true, interruptible: true, preregister: true }),
    envelopeType: ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: true }),
    censusOrigin: ProcessCensusOrigin.OFF_CHAIN_TREE,
    metadata: processMetadataPre,
    censusRoot,
    censusUri,
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

  // Waiting a bit
  await waitUntilPresent(processId, gwPool)

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

export async function registerVoterKeys(processId: string, processParams: ProcessContractParameters, accounts: TestAccount[], gwPool: IGatewayClient) {
  console.log("Registering keys")

  await Bluebird.map(accounts, async (account: TestAccount, idx: number) => {
    process.stdout.write(`Registering [${idx}] ; `)

    // The key (within the census) to sign the request
    const wallet = new Wallet(account.privateKey)

    // Generate the random secret key that will be used for voting
    const secretKey = Random.getBigInt(Poseidon.Q)
    account.secretKey = secretKey

    // Get a census proof to be able to register the new key
    const censusProof = await CensusOffChainApi.generateProof(processParams.censusRoot, { key: account.publicKeyEncoded }, gwPool)
    const requestedWeight = censusProof.weight

    const proof = Voting.packageSignedProof(processId, processParams.censusOrigin, censusProof)

    return CensusOnChainApi.registerVoterKey(processId, proof, secretKey, requestedWeight, wallet, gwPool)
  })
}


export async function submitVotes(processId: string, processParams: ProcessState, processMetadata: ProcessMetadata, accounts: TestAccount[], gwPool: IGatewayClient) {
  console.log("Launching votes")

  const state = await VotingApi.getProcessState(processId, gwPool)
  const circuitInfo = await VotingApi.getProcessCircuitInfo(processId, gwPool)
  const witnessGeneratorWasm = await VotingApi.fetchAnonymousWitnessGenerator(circuitInfo)
  const zKey = await VotingApi.fetchAnonymousVotingZKey(circuitInfo)
  const vKey = await VotingApi.fetchAnonymousVotingVerificationKey(circuitInfo)
  const processKeys = processParams.envelopeType.encryptedVotes ? await VotingApi.getProcessKeys(processId, gwPool) : null

  await Bluebird.map(accounts, async (account: TestAccount, idx: number) => {

    // VOTER
    const censusProof = await CensusOnChainApi.generateProof(state.rollingCensusRoot, account.secretKey, gwPool)

    const choices = getChoicesForVoter(processMetadata.questions.length, idx)

    // Prepare ZK Proof
    const nullifier = Voting.getAnonymousVoteNullifier(account.secretKey, processId)
    const { votePackage, keyIndexes } = Voting.packageVoteContent(choices, processKeys)

    const inputs: ZkInputs = {
      censusRoot: processParams.rollingCensusRoot,
      censusSiblings: censusProof.siblings,
      maxSize: circuitInfo.maxSize,
      keyIndex: censusProof.index,
      nullifier,
      secretKey: account.secretKey,
      processId: Voting.getSnarkProcessId(processId),
      votePackage
    }

    const zkProof = await ZkSnarks.computeProof(inputs, witnessGeneratorWasm, zKey)

    const verifyProof = await ZkSnarks.verifyProof(JSON.parse(Buffer.from(vKey).toString()), zkProof.publicSignals as any, zkProof.proof as any)
    if (config.stopOnError) assert(verifyProof)

    // the next line is to place the 'nullifier' into the position 0 of
    // publicSignals array. This is because in the Vochain, the rest of
    // publicSignals from the array are not going to be used, as those inputs
    // are going to be computed from known info of the process by the Vochain
    // itself. And the Vochain only needs the 'nullifier' being in the first
    // position of the array. In fact, the array could contain only 1 element
    // (the 'nullifier').
    zkProof.publicSignals = [nullifier.toString()]
    // alternatively:
    // zkProof.publicSignals[0] = zkProof.publicSignals[3];

    const envelopeParams: AnonymousEnvelopeParams = {
      votePackage,
      processId,
      zkProof,
      nullifier,
      circuitIndex: circuitInfo.index,
      encryptionKeyIndexes: keyIndexes
    }

    // Package and submit
    const envelope = Voting.packageAnonymousEnvelope(envelopeParams)

    await VotingApi.submitEnvelope(envelope, null, gwPool)

    await new Promise(resolve => setTimeout(resolve, 11000))

    // const nullifier = Voting.getAnonymousVoteNullifier(account.secretKey, processId)
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
      assert.strictEqual(+rawResults.results[0][0], config.numAccounts)
      assert.strictEqual(+rawResults.results[0][1], 0)
      break
    case "all-1":
      assert(rawResults.results[0].length >= 2)
      assert.strictEqual(+rawResults.results[0][0], 0)
      assert.strictEqual(+rawResults.results[0][1], config.numAccounts)
      break
    case "all-2":
      assert(rawResults.results[0].length >= 3)
      assert.strictEqual(+rawResults.results[0][0], 0)
      assert.strictEqual(+rawResults.results[0][1], 0)
      assert.strictEqual(+rawResults.results[0][2], config.numAccounts)
      break
    case "all-even":
      assert(rawResults.results[0].length >= 2)
      if (config.numAccounts % 2 == 0) {
        assert.strictEqual(+rawResults.results[0][0], config.numAccounts / 2)
        assert.strictEqual(+rawResults.results[0][1], config.numAccounts / 2)
      }
      else {
        assert.strictEqual(+rawResults.results[0][0], Math.ceil(config.numAccounts / 2))
        assert.strictEqual(+rawResults.results[0][1], Math.floor(config.numAccounts / 2))
      }
      break
    case "incremental":
      assert.strictEqual(+rawResults.results[0].length, 2)
      rawResults.results.forEach((question, i) => {
        for (let j = 0; j < question.length; j++) {
          if (i == j) assert.strictEqual(+question[j], config.numAccounts)
          else assert.strictEqual(+question[j], 0)
        }
      })
      break
    default:
      throw new Error("The type of votes is unknown")
  }

  assert.strictEqual(totalVotes, config.numAccounts)
}
