const fs = require("fs")
import * as Bluebird from "bluebird"
import axios from "axios"
import { Wallet, utils } from "ethers"
import * as assert from "assert"
import { readFileSync } from "fs"
import * as YAML from 'yaml'

const CONFIG_PATH = "./config.yaml"
const config = getConfig()

import { API, Network, Wrappers, Models, EtherUtils, JsonSign, ProcessMetadata } from "../dist"
import { NetworkID } from "../dist/net/gateway-bootnodes"
import { GatewayPool } from "../dist/net/gateway-pool"
import { getProcessKeys, cancelProcess, isCanceled } from "../dist/api/vote"
import { waitUntilVochainBlock, waitEthBlocks } from "../dist/util/waiters"

const { File, Entity, Census, Vote } = API
// const { Bootnodes, Gateways, Contracts } = Network
// const { GatewayInfo, ContentURI, ContentHashedURI } = Wrappers
const { Entity: { TextRecordKeys, EntityMetadataTemplate }, Vote: { ProcessMetadataTemplate } } = Models
// const { Providers, Signers } = EtherUtils
const { signJsonBody, isSignatureValid, recoverSignerPublicKey } = JsonSign

const { getEntityId, getEntityMetadataByAddress, updateEntity } = Entity
const { getRoot, addCensus, addClaim, addClaimBulk, digestHexClaim, getCensusSize, generateCensusId, generateCensusIdSuffix, publishCensus, importRemote, generateProof, dump, dumpPlain } = Census
// const { DVoteGateway, Web3Gateway } = Gateways
// const { addFile, fetchFileString } = File
const { createVotingProcess, getVoteMetadata, packagePollEnvelope, submitEnvelope, getBlockHeight, getEnvelopeHeight, getPollNullifier, getEnvelopeStatus, getProcessList, getTimeUntilStart, getTimeUntilEnd, getTimeForBlock, getBlockNumberForTime, getEnvelopeList, getEnvelope, getRawResults, getResultsDigest } = Vote
// const { getEntityResolverInstance, getVotingProcessInstance } = Contracts

// let entityResolver = null, votingProcess = null

let pool: GatewayPool, entityId: string, entityWallet: Wallet, processId: string, voteMetadata: ProcessMetadata, accounts: Account[]

async function main() {
  // Connect to a GW
  const gwPool = await connectGateways()
  pool = gwPool

  if (config.readExistingAccounts) {
    console.log("Reading account list")
    accounts = JSON.parse(fs.readFileSync(config.accountListFilePath).toString())
  }
  else {
    // Create from scratch
    console.log("Creating from scratch")

    // Set Entity Metadata
    await setEntityMetadata()

    // Create N wallets
    accounts = createWallets(config.numAccounts)

    // Write them to a file
    fs.writeFileSync(config.accountListFilePath, JSON.stringify(accounts, null, 2))

    // Submit the accounts to the entity
    const adminAccesstoken = await adminLogin()
    await databasePrepare(adminAccesstoken)
    await submitAccountsToRegistry(accounts)
    await checkDatabaseKeys(adminAccesstoken, accounts)
    assert(accounts)
  }

  if (config.readExistingProcess) {
    console.log("Reading process metadata")
    const procInfo = JSON.parse(fs.readFileSync(config.processInfoFilePath).toString())
    processId = procInfo.processId
    voteMetadata = procInfo.voteMetadata

    assert(processId)
    assert(voteMetadata)
  }
  else {
    let adminAccesstoken
    if (!config.readExistingAccounts) {
      adminAccesstoken = await adminLogin()
      await checkDatabaseKeys(adminAccesstoken, accounts)  // optional
    }

    // Generate and publish the census
    // Get the merkle root and IPFS origin of the Merkle Tree
    console.log("Publishing census")
    const { merkleRoot, merkleTreeUri } = config.readExistingAccounts ?
      await generatePublicCensusFromAccounts(accounts) :   // Read from JSON
      await generatePublicCensusFromDb(adminAccesstoken)   // Dump from DB

    // Create a new voting process
    await launchNewVote(merkleRoot, merkleTreeUri)
    assert(processId)
    assert(voteMetadata)
    fs.writeFileSync(config.processInfoFilePath, JSON.stringify({ processId, voteMetadata }, null, 2))

    console.log("The voting process is ready")
  }


  console.log("- Entity ID", voteMetadata.details.entityId)
  console.log("- Process ID", processId)
  console.log("- Process start block", voteMetadata.startBlock)
  console.log("- Process end block", voteMetadata.startBlock + voteMetadata.numberOfBlocks)
  console.log("- Process merkle root", voteMetadata.census.merkleRoot)
  console.log("- Process merkle tree", voteMetadata.census.merkleTree)
  console.log("-", accounts.length, "accounts on the census")
  console.log("- Entity Manager link:", config.entityManagerUriPrefix + "/processes/#/" + entityId + "/" + processId)

  // Wait until the current block >= startBlock
  await waitUntilStarted()

  // Submit votes for every account
  console.time("Voting 📩")
  await launchVotes(accounts)
  console.timeEnd("Voting 📩")

  await checkVoteResults()

  disconnect()
}

async function connectGateways(): Promise<GatewayPool> {
  console.log("Connecting to the gateways")
  const options = {
    networkId: config.ethNetworkId as NetworkID,
    bootnodesContentUri: config.bootnodesUrlRw,
    numberOfGateways: 2,
    race: false,
    // timeout: 10000,
  }
  const pool = await GatewayPool.discover(options)

  if (!(await pool.isConnected())) throw new Error("Could not connect to the network")
  console.log("Connected to", await pool.getDVoteUri())
  console.log("Connected to", pool.getProvider()["connection"].url)

  // WEB3 CLIENT
  entityWallet = Wallet.fromMnemonic(config.mnemonic, config.ethPath)
    .connect(pool.getProvider())

  entityId = getEntityId(await entityWallet.getAddress())
  console.log("Entity Address", await entityWallet.getAddress())
  console.log("Entity ID", entityId)

  return pool
}

async function setEntityMetadata() {
  if ((await entityWallet.getBalance()).eq(0))
    throw new Error("The account has no ether")
  console.log("Setting Metadata for entity", entityId)

  const metadata = JSON.parse(JSON.stringify(EntityMetadataTemplate))
  metadata.name = { default: "[Test] Entity " + Date.now() }
  metadata.description = { default: "[Test] Entity " + Date.now() }
  metadata.votingProcesses = {
    active: [],
    ended: []
  }

  metadata.actions = [
    {
      type: "register",
      actionKey: "register",
      name: {
        default: "Sign up",
      },
      url: config.registryApiPrefix + "/api/actions/register",
      visible: config.registryApiPrefix + "/api/actions"
    }
  ]

  await updateEntity(await entityWallet.getAddress(), metadata, entityWallet, pool)
  console.log("Metadata updated")

  // Read back
  const entityMetaPost = await getEntityMetadataByAddress(await entityWallet.getAddress(), pool)
  assert(entityMetaPost)
  assert.equal(entityMetaPost.name.default, metadata.name.default)
  assert.equal(entityMetaPost.description.default, metadata.description.default)
  assert.equal(entityMetaPost.actions.length, 1)
  assert.equal(entityMetaPost.votingProcesses.active.length, 0)
  assert.equal(entityMetaPost.votingProcesses.ended.length, 0)

  return entityMetaPost
}

function createWallets(amount) {
  console.log("Creating", amount, "wallets")
  const accounts = []
  for (let i = 0; i < amount; i++) {
    if (i % 50 == 0) process.stdout.write("Wallet " + i + " ; ")
    const wallet = Wallet.createRandom()
    accounts.push({
      idx: i,
      mnemonic: wallet.mnemonic,
      privateKey: wallet["signingKey"].privateKey,
      publicKey: wallet["signingKey"].publicKey,
      publicKeyHash: digestHexClaim(wallet["signingKey"].publicKey)
      // address: wallet.address
    })
  }

  console.log() // \n
  return accounts
}

async function adminLogin() {
  assert(entityWallet)
  console.log("Logging into the registry admin")

  // Admin Log in
  const msg = JSON.stringify({ timestamp: Date.now() })
  const msgBytes = utils.toUtf8Bytes(msg)
  const signature = await entityWallet.signMessage(msgBytes)

  let body = {
    payload: msg,
    signature
  }
  var response = await axios.post(config.censusManagerApiPrefix + "/api/auth/session", body)
  if (!response || !response.data || !response.data.token) throw new Error("Invalid Census Manager token")
  const token = response.data.token

  return token
}

async function databasePrepare(token) {
  // List current census
  var request: any = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }

  request.method = 'GET'
  request.url = config.censusManagerApiPrefix + "/api/census?filter=%7B%7D&order=ASC&perPage=100000&sort=name&start=0"

  var response = await axios(request)
  assert(Array.isArray(response.data))
  const cIds = response.data.map(item => item._id)

  // Delete current DB census
  if (cIds.length > 0) {
    console.log("Cleaning existing census")

    request.method = 'DELETE'
    request.data = undefined
    request.url = config.censusManagerApiPrefix + "/api/census?" + cIds.map(id => "ids=" + id).join("&")
    response = await axios(request)
  }

  // List current users
  request.method = 'GET'
  request.url = config.censusManagerApiPrefix + "/api/members?filter=%7B%7D&order=ASC&perPage=1000000&sort=name&start=0"

  response = await axios(request)
  assert(Array.isArray(response.data))
  const mIds = response.data.map(item => item._id)

  // Delete current DB users
  if (mIds.length > 0) {
    console.log("Cleaning existing members")

    request.method = 'DELETE'
    request.data = undefined

    // Delete in chunks of 100
    for (let i = 0; i < mIds.length / 100; i++) {
      const ids = mIds.slice(i * 100, i * 100 + 100)
      if (ids.length == 0) break

      request.url = config.censusManagerApiPrefix + "/api/members?" + ids.map(id => "ids=" + id).join("&")
      response = await axios(request)
    }
    response = await axios(request)
  }

  return token
}

async function submitAccountsToRegistry(accounts) {
  console.log("Registering", accounts.length, "accounts to the entity")

  await Bluebird.map(accounts, async (account, idx) => {
    if (idx % 50 == 0) process.stdout.write("Account " + idx + " ; ")
    const wallet = new Wallet(account.privateKey)
    const timestamp = Date.now()

    const body = {
      request: {
        method: "register",
        actionKey: "register",
        firstName: "Name",
        lastName: "Last Name " + idx,
        email: `user${idx}@mail.com`,
        phone: "1234 5678",
        dateOfBirth: `19${10 + (idx % 90)}-10-20T12:00:00.000Z`,
        entityId: entityId,
        timestamp: timestamp,
      },
      signature: ""
    }
    body.signature = await signJsonBody(body.request, wallet)

    const res = await axios.post(`${config.registryApiPrefix}/api/actions/register`, body)

    const response = res.data && res.data.response
    if (!response) throw new Error("Empty response")
    else if (response.error) throw new Error(response.error)
    else if (!response.ok) throw new Error("Registration returned ok: false")
  }, { concurrency: 50 })

  console.log() // \n
}

async function checkDatabaseKeys(token, accounts) {
  console.log("Checking database key values")

  // Get the DB members data
  var request: any = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }
  request.method = 'GET'
  request.url = config.censusManagerApiPrefix + "/api/members?filter=%7B%7D&order=ASC&perPage=1000000&sort=email&start=0"

  const response = await axios(request)
  if (config.stopOnError) assert(response.data.length >= config.numAccounts)

  const dbAccounts = response.data
  for (let account of accounts) {
    const dbAccount = dbAccounts.find(dbAccount => dbAccount.user.email == "user" + account.idx + "@mail.com")
    if (config.stopOnError) assert(dbAccount, "There is no such account for index " + account.idx)
    else if (!dbAccount) continue
    if (dbAccount.user.digestedPublicKey == account.publicKeyHash && dbAccount.user.publicKey == account.publicKey) continue

    // not found??
    console.error("Generated account does not match the one on the DB:")
    if (dbAccount.user.digestedPublicKey != account.publicKeyHash) {
      console.error("- Original pub key:", account.publicKey)
      console.error("- DB pub key:", dbAccount.user.publicKey)
    }
    else {
      console.error("- Pub key:", account.publicKey)
      console.error("- Original pub key hash:", account.publicKeyHash)
      console.error("- DB pub key hash:", dbAccount.user.digestedPublicKey)
    }
  }
}

async function generatePublicCensusFromDb(token) {
  // Create new census
  console.log("Creating a new census")

  var request: any = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }

  // Create the census we will later export
  request.method = 'POST'
  request.url = config.censusManagerApiPrefix + "/api/census"
  request.data = { "name": "E2E Test census " + Date.now(), "filters": [{ "key": "dateOfBirth", "predicate": { "operator": "$gt", "value": "1800-01-01" } }] }

  var response = await axios(request)
  assert(response.data._id.length == 24)
  const newCensusId = response.data._id

  // Dump the census
  console.log("Exporting the census", newCensusId)

  request.method = 'GET'
  request.url = config.censusManagerApiPrefix + "/api/census/" + newCensusId + "/dump"
  request.data = undefined

  response = await axios(request)
  const { censusIdSuffix, publicKeyDigests, managerPublicKeys } = response.data
  if (config.stopOnError) {
    assert(censusIdSuffix.length == 64)
    assert(Array.isArray(publicKeyDigests))
    assert(publicKeyDigests.length == config.numAccounts)
    assert(Array.isArray(managerPublicKeys))
    assert(managerPublicKeys.length == 1)
  }

  // Adding claims
  console.log("Registering the new census to the Census Service")

  const { censusId } = await addCensus(censusIdSuffix, managerPublicKeys, pool, entityWallet)

  console.log("Adding", publicKeyDigests.length, "claims")
  const result = await addClaimBulk(censusId, publicKeyDigests, true, pool, entityWallet)

  if (result.invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + result.invalidClaims.length)

  // Publish the census
  console.log("Publishing the new census")
  const merkleTreeUri = await publishCensus(censusId, pool, entityWallet)

  // Check that the census is published
  const exportedMerkleTree = await dumpPlain(censusId, pool, entityWallet)
  if (config.stopOnError) {
    assert(Array.isArray(exportedMerkleTree))
    assert(exportedMerkleTree.length == config.numAccounts)
  }

  // Return the census ID / Merkle Root
  return {
    merkleTreeUri,
    merkleRoot: result.merkleRoot
  }
}

async function generatePublicCensusFromAccounts(accounts) {
  // Create new census
  console.log("Creating a new census")

  const censusIdSuffix = require("crypto").createHash('sha256').update("" + Date.now()).digest().toString("hex")
  const publicKeyDigests = accounts.map(account => account.publicKeyHash)
  const managerPublicKeys = [entityWallet["signingKey"].publicKey]

  if (config.stopOnError) {
    assert(censusIdSuffix.length == 64)
    assert(Array.isArray(publicKeyDigests))
    assert(publicKeyDigests.length == config.numAccounts)
    assert(Array.isArray(managerPublicKeys))
    assert(managerPublicKeys.length == 1)
  }

  // Adding claims
  console.log("Registering the new census to the Census Service")

  const { censusId } = await addCensus(censusIdSuffix, managerPublicKeys, pool, entityWallet)

  console.log("Adding", publicKeyDigests.length, "claims")
  const result = await addClaimBulk(censusId, publicKeyDigests, true, pool, entityWallet)

  if (result.invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + result.invalidClaims.length)

  // Publish the census
  console.log("Publishing the new census")
  const merkleTreeUri = await publishCensus(censusId, pool, entityWallet)

  // Check that the census is published
  const exportedMerkleTree = await dumpPlain(censusId, pool, entityWallet)
  if (config.stopOnError) {
    assert(Array.isArray(exportedMerkleTree))
    assert(exportedMerkleTree.length == config.numAccounts)
  }

  // Return the census ID / Merkle Root
  return {
    merkleTreeUri,
    merkleRoot: result.merkleRoot
  }
}

async function launchNewVote(merkleRoot, merkleTreeUri) {
  assert(merkleRoot)
  assert(merkleTreeUri)
  console.log("Preparing the new vote metadata")

  const processMetadataPre: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
  processMetadataPre.type = config.encryptedVote ? "encrypted-poll" : "poll-vote"
  processMetadataPre.census.merkleRoot = merkleRoot
  processMetadataPre.census.merkleTree = merkleTreeUri
  processMetadataPre.details.entityId = entityId
  processMetadataPre.details.encryptionPublicKey = "0x0"
  processMetadataPre.details.title.default = "E2E process"
  processMetadataPre.details.description.default = "E2E process"
  processMetadataPre.details.questions[0].question.default = "Should 1+1 equal 2?"
  processMetadataPre.details.questions[0].description.default = "Description here"
  processMetadataPre.details.questions[0].voteOptions[0].title.default = "Yes"
  processMetadataPre.details.questions[0].voteOptions[0].value = 0
  processMetadataPre.details.questions[0].voteOptions[1].title.default = "No"
  processMetadataPre.details.questions[0].voteOptions[1].value = 1

  console.log("Getting the block height")
  const currentBlock = await getBlockHeight(pool)
  const startBlock = currentBlock + 25
  processMetadataPre.startBlock = startBlock
  processMetadataPre.numberOfBlocks = 60480
  console.log("Creating the process")
  processId = await createVotingProcess(processMetadataPre, entityWallet, pool)

  console.log("Reading the process metadata back")
  const entityMetaPost = await getEntityMetadataByAddress(await entityWallet.getAddress(), pool)

  assert(processId)
  assert(entityMetaPost)

  // Reading back
  voteMetadata = await getVoteMetadata(processId, pool)
  assert.equal(voteMetadata.details.entityId, entityId)
  assert.equal(voteMetadata.startBlock, processMetadataPre.startBlock, "SENT " + JSON.stringify(processMetadataPre) + " GOT " + JSON.stringify(voteMetadata))
  assert.equal(voteMetadata.numberOfBlocks, processMetadataPre.numberOfBlocks)
  assert.equal(voteMetadata.census.merkleRoot, processMetadataPre.census.merkleRoot)
  assert.equal(voteMetadata.census.merkleTree, processMetadataPre.census.merkleTree)
}

async function waitUntilStarted() {
  assert(pool)
  assert(processId)
  assert(voteMetadata)

  await waitUntilVochainBlock(voteMetadata.startBlock, pool, { verbose: true })

  console.log("Checking that the Process ID is on the list")

  let processList: string[] = await getProcessList(entityId, pool)
  assert(processList.length > 0)

  let lastId = processList[processList.length - 1]
  const trimProcId = processId.replace(/^0x/, "")
  while (!processList.some(v => v == trimProcId) && processList.length > 1) {
    processList = await getProcessList(entityId, pool, lastId)
    if (processList.length) {
      if (lastId == processList[processList.length - 1]) break
      lastId = processList[processList.length - 1]
    }
  }
  assert(processList.some(v => v == trimProcId))
}

async function launchVotes(accounts) {
  console.log("Launching votes")

  const processKeys = voteMetadata.type == "encrypted-poll" ? await getProcessKeys(processId, pool) : null

  await Bluebird.map(accounts, async (account, idx) => {
    process.stdout.write(`Starting [${idx}] ; `)

    const wallet = new Wallet(account.privateKey)

    process.stdout.write(`Gen Proof [${idx}] ; `)
    const merkleProof = await generateProof(voteMetadata.census.merkleRoot, account.publicKeyHash, true, pool)
      .catch(err => {
        console.error("\ngenerateProof ERR", account, err)
        if (config.stopOnError) throw err
        return null
      })
    if (!merkleProof) return // skip when !config.stopOnError

    process.stdout.write(`Pkg Envelope [${idx}] ; `)
    const choices = getChoicesForVoter(idx)

    const voteEnvelope = voteMetadata.type == "encrypted-poll" ?
      await packagePollEnvelope({ votes: choices, merkleProof, processId, walletOrSigner: wallet, processKeys }) :
      await packagePollEnvelope({ votes: choices, merkleProof, processId, walletOrSigner: wallet })

    process.stdout.write(`Sending [${idx}] ; `)
    await submitEnvelope(voteEnvelope, pool)
      .catch(err => {
        console.error("\nsubmitEnvelope ERR", account.publicKey, voteEnvelope, err)
        if (config.stopOnError) throw err
      })

    process.stdout.write(`Waiting [${idx}] ; `)
    await new Promise(resolve => setTimeout(resolve, 11000))

    process.stdout.write(`Checking [${idx}] ; `)
    const nullifier = await getPollNullifier(wallet.address, processId)
    const hasVoted = await getEnvelopeStatus(processId, nullifier, pool)
      .catch(err => {
        console.error("\ngetEnvelopeStatus ERR", account.publicKey, nullifier, err)
        if (config.stopOnError) throw err
      })

    if (config.stopOnError) assert(hasVoted)

    process.stdout.write(`Done [${idx}] ; `)
  }, { concurrency: config.maxConcurrency })

  console.log() // \n
}

async function checkVoteResults() {
  assert.equal(typeof processId, "string")

  if (config.encryptedVote) {
    console.log("Waiting a bit for the votes to be received", processId)
    const nextBlock = 2 + await getBlockHeight(pool)
    await waitUntilVochainBlock(nextBlock, pool, { verbose: true })

    console.log("Fetching the number of votes for", processId)
    const envelopeHeight = await getEnvelopeHeight(processId, pool)
    assert.equal(envelopeHeight, config.numAccounts)

    if (!(await isCanceled(processId, pool))) {
      console.log("Canceling/ending the process", processId)
      await cancelProcess(processId, entityWallet, pool)

      console.log("Waiting a bit for the votes to be decrypted", processId)
      await waitEthBlocks(18, pool, { verbose: true })
    }
  }
  console.log("Waiting a bit for the results to be ready", processId)
  const nextBlock = 3 + await getBlockHeight(pool)
  await waitUntilVochainBlock(nextBlock, pool, { verbose: true })

  console.log("Fetching the vote results for", processId)
  const resultsDigest = await getResultsDigest(processId, pool)
  const totalVotes = await getEnvelopeHeight(processId, pool)

  assert.equal(resultsDigest.questions.length, 1)
  assert(resultsDigest.questions[0].voteResults)

  switch (config.votesPattern) {
    case "all-0":
      assert(resultsDigest.questions[0].voteResults.length >= 2)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, config.numAccounts)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)
      break
    case "all-1":
      assert(resultsDigest.questions[0].voteResults.length >= 2)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, config.numAccounts)
      break
    case "all-2":
      assert(resultsDigest.questions[0].voteResults.length >= 3)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[2].votes, config.numAccounts)
      break
    case "all-even":
      assert(resultsDigest.questions[0].voteResults.length >= 2)
      if (config.numAccounts % 2 == 0) {
        assert.equal(resultsDigest.questions[0].voteResults[0].votes, config.numAccounts / 2)
        assert.equal(resultsDigest.questions[0].voteResults[1].votes, config.numAccounts / 2)
      }
      else {
        assert.equal(resultsDigest.questions[0].voteResults[0].votes, Math.ceil(config.numAccounts / 2))
        assert.equal(resultsDigest.questions[0].voteResults[1].votes, Math.floor(config.numAccounts / 2))
      }
      break
    case "incremental":
      assert.equal(resultsDigest.questions[0].voteResults.length, 2)
      resultsDigest.questions.forEach((question, i) => {
        for (let j = 0; j < question.voteResults.length; j++) {
          if (i == j) assert.equal(question.voteResults[j].votes, config.numAccounts)
          else assert.equal(question.voteResults[j].votes, 0)
        }
      })
      break
    default:
      throw new Error("The type of votes is unknown")
  }

  assert.equal(totalVotes, config.numAccounts)
}

async function disconnect() {
  pool.disconnect()
}

/////////////////////////////////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////////////////////////////////

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

/////////////////////////////////////////////////////////////////////////////
// HELPERS
/////////////////////////////////////////////////////////////////////////////

function getChoicesForVoter(voterIdx) {
  assert.equal(typeof voterIdx, "number")
  assert(voteMetadata.details)
  assert(voteMetadata.details.questions)

  return voteMetadata.details.questions.map((_, idx) => {
    switch (config.votesPattern) {
      case "all-0": return 0
      case "all-1": return 1
      case "all-2": return 2
      case "all-even": return (voterIdx % 2 == 0) ? 0 : 1
      case "incremental": return idx
      default: return 0
    }
  })
}

function getConfig(): Config {
  const config: Config = YAML.parse(readFileSync(CONFIG_PATH).toString())
  assert(typeof config == "object", "The config file appears to be invalid")
  assert(typeof config.readExistingAccounts == "boolean", "config.yaml > readExistingAccounts should be a boolean")
  assert(typeof config.readExistingProcess == "boolean", "config.yaml > readExistingProcess should be a boolean")
  assert(typeof config.stopOnError == "boolean", "config.yaml > stopOnError should be a boolean")
  assert(typeof config.accountListFilePath == "string", "config.yaml > accountListFilePath should be a string")
  assert(typeof config.processInfoFilePath == "string", "config.yaml > processInfoFilePath should be a string")
  assert(typeof config.mnemonic == "string", "config.yaml > mnemonic should be a string")
  assert(config.mnemonic, "config.yaml > Please, set the mnemonic to use")
  assert(typeof config.ethPath == "string", "config.yaml > ethPath should be a string")
  assert(typeof config.ethNetworkId == "string", "config.yaml > ethNetworkId should be a string")
  assert(typeof config.bootnodesUrlRw == "string", "config.yaml > bootnodesUrlRw should be a string")
  assert(!config.dvoteGatewayUri || typeof config.dvoteGatewayUri == "string", "config.yaml > dvoteGatewayUri should be a string")
  assert(!config.dvoteGatewayPublicKey || typeof config.dvoteGatewayPublicKey == "string", "config.yaml > dvoteGatewayPublicKey should be a string")
  assert(typeof config.registryApiPrefix == "string", "config.yaml > registryApiPrefix should be a string")
  assert(typeof config.censusManagerApiPrefix == "string", "config.yaml > censusManagerApiPrefix should be a string")
  assert(typeof config.entityManagerUriPrefix == "string", "config.yaml > entityManagerUriPrefix should be a string")
  assert(typeof config.numAccounts == "number", "config.yaml > numAccounts should be a number")
  assert(typeof config.maxConcurrency == "number", "config.yaml > maxConcurrency should be a number")
  assert(typeof config.encryptedVote == "boolean", "config.yaml > encryptedVote should be a boolean")
  assert(typeof config.votesPattern == "string", "config.yaml > votesPattern should be a string")
  return config
}

type Config = {
  readExistingAccounts: boolean
  readExistingProcess: boolean
  stopOnError: boolean

  accountListFilePath: string
  processInfoFilePath: string

  mnemonic: string
  ethPath: string
  ethNetworkId: string

  bootnodesUrlRw: string
  dvoteGatewayUri: string
  dvoteGatewayPublicKey: string

  registryApiPrefix: string
  censusManagerApiPrefix: string
  entityManagerUriPrefix: string

  numAccounts: number
  maxConcurrency: number

  encryptedVote: boolean
  votesPattern: string
}

type Account = {
  idx: number,
  mnemonic: string
  privateKey: string
  publicKey: string
  publicKeyHash: string
}
