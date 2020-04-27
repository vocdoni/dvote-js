console.log("Reading .env (if present)...")
require('dotenv').config({ path: __dirname + "/.env" })
const assert = require("assert")
const fs = require("fs")
const Promise = require("bluebird")
const axios = require("axios")

const {
  API: { File, Entity, Census, Vote },
  Network: { Bootnodes, Gateway, Contracts },
  Wrappers: { GatewayInfo, ContentURI, ContentHashedURI },
  Models: { Entity: { TextRecordKeys, EntityMetadataTemplate }, Vote: { ProcessMetadataTemplate } },
  EtherUtils: { Providers, Signers },
  JsonSign: { signJsonBody, isSignatureValid, recoverSignerPublicKey }
} = require("../dist")

const { getEntityId, getEntityMetadataByAddress, updateEntity } = Entity
const { getRoot, addCensus, addClaim, addClaimBulk, digestHexClaim, getCensusSize, generateCensusId, generateCensusIdSuffix, publishCensus, importRemote, generateProof, dump, dumpPlain } = Census
const { DVoteGateway, Web3Gateway } = Gateway
const { getGatewaysFromBootNode, getDefaultGateways, getRandomGatewayInfo } = Bootnodes
const { addFile, fetchFileString } = File
const { createVotingProcess, getVoteMetadata, packagePollEnvelope, submitEnvelope, getBlockHeight, getEnvelopeHeight, getPollNullifier, getEnvelopeStatus, getTimeUntilStart, getTimeUntilEnd, getTimeForBlock, getBlockNumberForTime, getEnvelopeList, getEnvelope, getRawResults, getResultsDigest } = Vote
const { getEntityResolverInstance, getVotingProcessInstance } = Contracts

const { Wallet, utils } = require("ethers")

const MNEMONIC = process.env.MNEMONIC || "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = process.env.ETH_PATH || "m/44'/60'/0'/0/0"

const ACCOUNT_LIST_FILE_PATH = "./cached-accounts.json"
const PROCESS_INFO_FILE_PATH = "./cached-process-info.json"

const READ_EXISTING_ACCOUNTS = !!process.env.READ_EXISTING_ACCOUNTS
const READ_EXISTING_PROCESS = !!process.env.READ_EXISTING_PROCESS
const STOP_ON_ERROR = !!process.env.STOP_ON_ERROR

const ETH_NETWORK_ID = process.env.ETH_NETWORK_ID || "goerli"
const BOOTNODES_URL_RW = process.env.BOOTNODES_URL_RW
const DVOTE_GATEWAY_URI = process.env.DVOTE_GATEWAY_URI || undefined
const DVOTE_GATEWAY_PUBLIC_KEY = process.env.DVOTE_GATEWAY_PUBLIC_KEY || undefined

const REGISTRY_API_PREFIX = process.env.REGISTRY_API_PREFIX
const CENSUS_MANAGER_API_PREFIX = process.env.CENSUS_MANAGER_API_PREFIX
const ENTITY_MANAGER_URI_PREFIX = process.env.ENTITY_MANAGER_URI_PREFIX

const NUM_ACCOUNTS = parseInt(process.env.NUM_ACCOUNTS || "1000") || 1000
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "100") || 100
const VOTES_PATTERN = process.env.VOTES_PATTERN || "all-0" // Valid: all-0, all-1, all-2, all-even, incremental

let entityResolver = null
let votingProcess = null
let dvoteGateway
let web3Gateway

let entityId
let entityWallet
let processId
let voteMetadata
let accounts


async function main() {
  // Connect to a GW
  await connectGateways()

  if (READ_EXISTING_ACCOUNTS) {
    console.log("Reading account list")
    accounts = JSON.parse(fs.readFileSync(ACCOUNT_LIST_FILE_PATH).toString())
  }
  else {
    // Create from scratch
    console.log("Creating from scratch")

    // Set Entity Metadata
    await setEntityMetadata()

    // Create N wallets
    accounts = createWallets(NUM_ACCOUNTS)

    // Write them to a file
    fs.writeFileSync(ACCOUNT_LIST_FILE_PATH, JSON.stringify(accounts, null, 2))

    // Submit the accounts to the entity
    const adminAccesstoken = await adminLogin()
    await databasePrepare(adminAccesstoken)
    await submitAccountsToRegistry(accounts)
    await checkDatabaseKeys(adminAccesstoken, accounts)
    assert(accounts)
  }

  if (READ_EXISTING_PROCESS) {
    console.log("Reading process metadata")
    const procInfo = JSON.parse(fs.readFileSync(PROCESS_INFO_FILE_PATH).toString())
    processId = procInfo.processId
    voteMetadata = procInfo.voteMetadata

    assert(processId)
    assert(voteMetadata)
  }
  else {
    let adminAccesstoken
    if (!READ_EXISTING_ACCOUNTS) {
      adminAccesstoken = await adminLogin()
      await checkDatabaseKeys(adminAccesstoken, accounts)  // optional
    }

    // Generate and publish the census
    // Get the merkle root and IPFS origin of the Merkle Tree
    console.log("Publishing census")
    const { merkleRoot, merkleTreeUri } = READ_EXISTING_ACCOUNTS ?
      await generatePublicCensusFromAccounts(accounts) :   // Read from JSON
      await generatePublicCensusFromDb(adminAccesstoken)   // Dump from DB

    // Create a new voting process
    await launchNewVote(merkleRoot, merkleTreeUri)
    assert(processId)
    assert(voteMetadata)
    fs.writeFileSync(PROCESS_INFO_FILE_PATH, JSON.stringify({ processId, voteMetadata }))

    console.log("The voting process is ready")
  }


  console.log("- Entity ID", voteMetadata.details.entityId)
  console.log("- Process ID", processId)
  console.log("- Process start block", voteMetadata.startBlock)
  console.log("- Process end block", voteMetadata.startBlock + voteMetadata.numberOfBlocks)
  console.log("- Process merkle root", voteMetadata.census.merkleRoot)
  console.log("- Process merkle tree", voteMetadata.census.merkleTree)
  console.log("-", accounts.length, "accounts on the census")
  console.log("- Entity Manager link:", ENTITY_MANAGER_URI_PREFIX + "/processes/#/" + entityId + "/" + processId)

  // Wait until the current block >= startBlock
  await waitUntilStarted()

  // Submit votes for every account
  console.time("Voting 📩")
  await launchVotes(accounts)
  console.timeEnd("Voting 📩")

  await checkVoteResults()

  disconnect()
}

async function connectGateways() {
  console.log("Connecting to the gateways")

  const gws = await getGatewaysFromBootNode(BOOTNODES_URL_RW)
  if (!gws || !gws[ETH_NETWORK_ID]) throw new Error("Could not connect to the network")
  else if (!gws[ETH_NETWORK_ID].dvote || !gws[ETH_NETWORK_ID].dvote.length) throw new Error("Could not connect to the network")
  else if (!gws[ETH_NETWORK_ID].web3 || !gws[ETH_NETWORK_ID].web3.length) throw new Error("Could not connect to the network")

  // Get working DvoteGW
  let success = false

  if (DVOTE_GATEWAY_URI && DVOTE_GATEWAY_PUBLIC_KEY) {
    try {
      const gw = new DVoteGateway({ uri: DVOTE_GATEWAY_URI, publicKey: DVOTE_GATEWAY_PUBLIC_KEY, supportedApis: ["census", "file", "vote", "results"] })
      await gw.connect()
      await gw.getGatewayInfo()
      dvoteGateway = gw
      success = true
    }
    catch (err) {
      console.error(DVOTE_GATEWAY_URI, "is down, using default")
    }
  }

  if (!success) {
    for (let gw of gws[ETH_NETWORK_ID].dvote) {
      try {
        await gw.connect()
        await gw.getGatewayInfo()
        dvoteGateway = gw
        success = true
      }
      catch (err) {
        console.log("DVoteGW failed", err)
        continue
      }
    }
  }
  if (!success) throw new Error("Could not connect to the network")
  console.log("Connected to", await dvoteGateway.getUri())

  // WEB3 CLIENT
  const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

  // const provider = getDefaultProvider(ETH_NETWORK_ID)
  // web3Gateway = new Web3Gateway(provider)

  // entityResolver = await getEntityResolverInstance({ provider, signer: wallet })
  // votingProcess = await getVotingProcessInstance({ provider, signer: wallet })

  success = false
  for (let w3 of gws[ETH_NETWORK_ID].web3) {
    try {
      // Get the contract instances
      entityResolver = await getEntityResolverInstance({ provider: w3.getProvider(), signer: wallet })
      votingProcess = await getVotingProcessInstance({ provider: w3.getProvider(), signer: wallet })

      web3Gateway = w3
      success = true
    }
    catch (err) {
      console.error("Web3 GW failed", err)
      continue
    }
  }
  if (!success) throw new Error("Could not connect to the network")
  console.log("Connected to", web3Gateway.getProvider().connection.url)

  entityWallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    .connect(web3Gateway.getProvider())

  entityId = getEntityId(await entityWallet.getAddress())
  console.log("Entity Address", await entityWallet.getAddress())
  console.log("Entity ID", entityId)
}

async function setEntityMetadata() {
  if ((await entityWallet.getBalance()) == 0)
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
      url: REGISTRY_API_PREFIX + "/api/actions/register",
      visible: REGISTRY_API_PREFIX + "/api/actions"
    }
  ]

  await updateEntity(await entityWallet.getAddress(), metadata, entityWallet, web3Gateway, dvoteGateway)
  console.log("Metadata updated")

  // Read back
  const entityMetaPost = await getEntityMetadataByAddress(await entityWallet.getAddress(), web3Gateway, dvoteGateway)
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
      privateKey: wallet.signingKey.privateKey,
      publicKey: wallet.signingKey.publicKey,
      publicKeyHash: digestHexClaim(wallet.signingKey.publicKey)
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
  var response = await axios.post(CENSUS_MANAGER_API_PREFIX + "/api/auth/session", body)
  if (!response || !response.data || !response.data.token) throw new Error("Invalid Census Manager token")
  const token = response.data.token

  return token
}

async function databasePrepare(token) {
  // List current census
  var request = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }

  request.method = 'GET'
  request.url = CENSUS_MANAGER_API_PREFIX + "/api/census?filter=%7B%7D&order=ASC&perPage=100000&sort=name&start=0"

  response = await axios(request)
  assert(Array.isArray(response.data))
  const cIds = response.data.map(item => item._id)

  // Delete current DB census
  if (cIds.length > 0) {
    console.log("Cleaning existing census")

    request.method = 'DELETE'
    request.data = undefined
    request.url = CENSUS_MANAGER_API_PREFIX + "/api/census?" + cIds.map(id => "ids=" + id).join("&")
    response = await axios(request)
  }

  // List current users
  request.method = 'GET'
  request.url = CENSUS_MANAGER_API_PREFIX + "/api/members?filter=%7B%7D&order=ASC&perPage=1000000&sort=name&start=0"

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

      request.url = CENSUS_MANAGER_API_PREFIX + "/api/members?" + ids.map(id => "ids=" + id).join("&")
      response = await axios(request)
    }
    response = await axios(request)
  }

  return token
}

async function submitAccountsToRegistry(accounts) {
  console.log("Registering", accounts.length, "accounts to the entity")

  await Promise.map(accounts, async (account, idx) => {
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

    const res = await axios.post(`${REGISTRY_API_PREFIX}/api/actions/register`, body)

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
  var request = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }
  request.method = 'GET'
  request.url = CENSUS_MANAGER_API_PREFIX + "/api/members?filter=%7B%7D&order=ASC&perPage=1000000&sort=email&start=0"

  const response = await axios(request)
  if (STOP_ON_ERROR) assert(response.data.length >= NUM_ACCOUNTS)

  const dbAccounts = response.data
  for (let account of accounts) {
    const dbAccount = dbAccounts.find(dbAccount => dbAccount.user.email == "user" + account.idx + "@mail.com")
    if (STOP_ON_ERROR) assert(dbAccount, "There is no such account for index " + account.idx)
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

  var request = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': "session-jwt=" + token
    },
    json: true
  }

  // Create the census we will later export
  request.method = 'POST'
  request.url = CENSUS_MANAGER_API_PREFIX + "/api/census"
  request.data = { "name": "E2E Test census " + Date.now(), "filters": [{ "key": "dateOfBirth", "predicate": { "operator": "$gt", "value": "1800-01-01" } }] }

  response = await axios(request)
  assert(response.data._id.length == 24)
  const newCensusId = response.data._id

  // Dump the census
  console.log("Exporting the census", newCensusId)

  request.method = 'GET'
  request.url = CENSUS_MANAGER_API_PREFIX + "/api/census/" + newCensusId + "/dump"
  request.data = undefined

  response = await axios(request)
  const { censusIdSuffix, publicKeyDigests, managerPublicKeys } = response.data
  if (STOP_ON_ERROR) {
    assert(censusIdSuffix.length == 64)
    assert(Array.isArray(publicKeyDigests))
    assert(publicKeyDigests.length == NUM_ACCOUNTS)
    assert(Array.isArray(managerPublicKeys))
    assert(managerPublicKeys.length == 1)
  }

  // Adding claims
  console.log("Registering the new census to the Census Service")

  const { censusId } = await addCensus(censusIdSuffix, managerPublicKeys, dvoteGateway, entityWallet)

  console.log("Adding", publicKeyDigests.length, "claims")
  response = await addClaimBulk(censusId, publicKeyDigests, true, dvoteGateway, entityWallet)

  if (response.invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + response.invalidClaims.length)

  // Publish the census
  console.log("Publishing the new census")
  const merkleTreeUri = await publishCensus(censusId, dvoteGateway, entityWallet)

  // Check that the census is published
  const exportedMerkleTree = await dumpPlain(censusId, dvoteGateway, entityWallet)
  if (STOP_ON_ERROR) {
    assert(Array.isArray(exportedMerkleTree))
    assert(exportedMerkleTree.length == NUM_ACCOUNTS)
  }

  // Return the census ID / Merkle Root
  return {
    merkleTreeUri,
    merkleRoot: response.merkleRoot
  }
}

async function generatePublicCensusFromAccounts(accounts) {
  // Create new census
  console.log("Creating a new census")

  const censusIdSuffix = require("crypto").createHash('sha256').update("" + Date.now()).digest().toString("hex")
  const publicKeyDigests = accounts.map(account => account.publicKeyHash)
  const managerPublicKeys = [entityWallet.signingKey.publicKey]

  if (STOP_ON_ERROR) {
    assert(censusIdSuffix.length == 64)
    assert(Array.isArray(publicKeyDigests))
    assert(publicKeyDigests.length == NUM_ACCOUNTS)
    assert(Array.isArray(managerPublicKeys))
    assert(managerPublicKeys.length == 1)
  }

  // Adding claims
  console.log("Registering the new census to the Census Service")

  const { censusId } = await addCensus(censusIdSuffix, managerPublicKeys, dvoteGateway, entityWallet)

  console.log("Adding", publicKeyDigests.length, "claims")
  response = await addClaimBulk(censusId, publicKeyDigests, true, dvoteGateway, entityWallet)

  if (response.invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + response.invalidClaims.length)

  // Publish the census
  console.log("Publishing the new census")
  const merkleTreeUri = await publishCensus(censusId, dvoteGateway, entityWallet)

  // Check that the census is published
  const exportedMerkleTree = await dumpPlain(censusId, dvoteGateway, entityWallet)
  if (STOP_ON_ERROR) {
    assert(Array.isArray(exportedMerkleTree))
    assert(exportedMerkleTree.length == NUM_ACCOUNTS)
  }

  // Return the census ID / Merkle Root
  return {
    merkleTreeUri,
    merkleRoot: response.merkleRoot
  }
}

async function launchNewVote(merkleRoot, merkleTreeUri) {
  assert(merkleRoot)
  assert(merkleTreeUri)
  console.log("Preparing the new vote metadata")

  const processMetadataPre = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
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

  const currentBlock = await getBlockHeight(dvoteGateway)
  const startBlock = currentBlock + 25
  processMetadataPre.startBlock = startBlock
  processMetadataPre.numberOfBlocks = 60480
  processId = await createVotingProcess(processMetadataPre, entityWallet, web3Gateway, dvoteGateway)

  const entityMetaPost = await getEntityMetadataByAddress(await entityWallet.getAddress(), web3Gateway, dvoteGateway)

  assert(processId)
  assert(entityMetaPost)

  // Reading back
  voteMetadata = await getVoteMetadata(processId, web3Gateway, dvoteGateway)
  assert.equal(voteMetadata.details.entityId, entityId)
  assert.equal(voteMetadata.startBlock, processMetadataPre.startBlock, "SENT " + JSON.stringify(processMetadataPre) + " GOT " + JSON.stringify(voteMetadata))
  assert.equal(voteMetadata.numberOfBlocks, processMetadataPre.numberOfBlocks)
  assert.equal(voteMetadata.census.merkleRoot, processMetadataPre.census.merkleRoot)
  assert.equal(voteMetadata.census.merkleTree, processMetadataPre.census.merkleTree)
}

async function waitUntilStarted() {
  assert(dvoteGateway)
  assert(processId)
  assert(voteMetadata)

  const currentBlock = await getBlockHeight(dvoteGateway)
  if (currentBlock >= voteMetadata.startBlock) return processId

  console.log("Waiting for block", voteMetadata.startBlock)

  // wait
  await new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      getBlockHeight(dvoteGateway).then(currentBlock => {
        console.log("Now at block", currentBlock)
        if (currentBlock >= voteMetadata.startBlock) {
          resolve()
          clearInterval(interval)
        }
      })
        .catch(err => reject(err))
    }, 10000)
  })
}

async function launchVotes(accounts) {
  console.log("Launching votes")

  await Promise.map(accounts, async (account, idx) => {
    process.stdout.write(`Starting [${idx}] ; `)

    const wallet = new Wallet(account.privateKey)

    process.stdout.write(`Gen Proof [${idx}] ; `)
    const merkleProof = await generateProof(voteMetadata.census.merkleRoot, account.publicKeyHash, true, dvoteGateway)
      .catch(err => {
        console.error("\ngenerateProof ERR", account, err)
        if (STOP_ON_ERROR) throw err
        return null
      })
    if (!merkleProof) return // skip when !STOP_ON_ERROR

    process.stdout.write(`Pkg Envelope [${idx}] ; `)
    const choices = getChoicesForVoter(idx)
    // TODO: Use encrypted payloads
    const voteEnvelope = await packagePollEnvelope({ votes: choices, merkleProof, processId, walletOrSigner: wallet })
    process.stdout.write(`Submit [${idx}] ; `)
    await submitEnvelope(voteEnvelope, dvoteGateway)
      .catch(err => {
        console.error("\nsubmitEnvelope ERR", account.publicKey, voteEnvelope, err)
        if (STOP_ON_ERROR) throw err
      })

    process.stdout.write(`Waiting [${idx}] ; `)
    await new Promise(resolve => setTimeout(resolve, 11000))

    process.stdout.write(`Checking [${idx}] ; `)
    const nullifier = await getPollNullifier(wallet.address, processId)
    const hasVoted = await getEnvelopeStatus(processId, nullifier, dvoteGateway)
      .catch(err => {
        console.error("\ngetEnvelopeStatus ERR", account.publicKey, nullifier, err)
        if (STOP_ON_ERROR) throw err
      })

    if (STOP_ON_ERROR) assert(hasVoted)

    process.stdout.write(`Done [${idx}] ; `)
  }, { concurrency: MAX_CONCURRENCY })

  console.log() // \n
}

async function checkVoteResults() {
  console.log("\nWaiting a bit for the votes to be processed")
  await new Promise((resolve) => setTimeout(resolve, 1000 * 10 * 3)) // wait ~2 blocks

  assert.equal(typeof processId, "string")

  console.log("Fetching the vote results for", processId)
  const resultsDigest = await getResultsDigest(processId, web3Gateway, dvoteGateway)
  const totalVotes = await getEnvelopeHeight(processId, dvoteGateway)

  assert.equal(resultsDigest.questions.length, 1)
  assert(resultsDigest.questions[0].voteResults)

  switch (VOTES_PATTERN) {
    case "all-0":
      assert(resultsDigest.questions[0].voteResults.length >= 2)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, NUM_ACCOUNTS)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)
      break
    case "all-1":
      assert(resultsDigest.questions[0].voteResults.length >= 2)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, NUM_ACCOUNTS)
      break
    case "all-2":
      assert(resultsDigest.questions[0].voteResults.length >= 3)
      assert.equal(resultsDigest.questions[0].voteResults[0].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)
      assert.equal(resultsDigest.questions[0].voteResults[2].votes, NUM_ACCOUNTS)
      break
    case "all-even":
      assert(resultsDigest.questions[0].voteResults.lengt >= 2)
      if (NUM_ACCOUNTS % 2 == 0) {
        assert.equal(resultsDigest.questions[0].voteResults[0].votes, NUM_ACCOUNTS / 2)
        assert.equal(resultsDigest.questions[0].voteResults[1].votes, NUM_ACCOUNTS / 2)
      }
      else {
        assert.equal(resultsDigest.questions[0].voteResults[0].votes, Math.ceil(NUM_ACCOUNTS / 2))
        assert.equal(resultsDigest.questions[0].voteResults[1].votes, Math.floor(NUM_ACCOUNTS / 2))
      }
      break
    case "incremental":
      assert.equal(resultsDigest.questions[0].voteResults.length, 2)
      resultsDigest.questions.forEach((question, i) => {
        for (let j = 0; j < question.voteResults.length; j++) {
          if (i == j) assert.equal(question.voteResults[j].votes, NUM_ACCOUNTS)
          else assert.equal(question.voteResults[j].votes, 0)
        }
      })
      break
    default:
      throw new Error("The type of votes is unknown")
  }

  assert.equal(totalVotes, NUM_ACCOUNTS)
}

async function disconnect() {
  dvoteGateway.disconnect()
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
    switch (VOTES_PATTERN) {
      case "all-0": return 0
      case "all-1": return 1
      case "all-2": return 2
      case "all-even": return (voterIdx % 2 == 0) ? 0 : 1
      case "incremental": return idx
      default: return 0
    }
  })
}