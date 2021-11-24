import * as Bluebird from "bluebird"
import { Wallet, utils } from "ethers"
import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import * as YAML from 'yaml'
import { GatewayPool } from "../../src/net/gateway-pool"
import { EntityMetadataTemplate } from "../../src/models/entity"
import { EntityApi } from "../../src/api/entity"
import { VotingApi } from "../../src/api/voting"
import { CensusOffChain, CensusOffChainApi } from "../../src/api/census"
import { INewProcessParams, IProofGraviton, ProcessMetadata, ProcessMetadataTemplate } from "../../src/models/process"
import { ProcessContractParameters, ProcessMode, ProcessEnvelopeType, ProcessStatus, IProcessCreateParams, ProcessCensusOrigin } from "../../src/net/contracts"
import { VochainWaiter, EthWaiter } from "../../src/util/waiters"
import { compressPublicKey, EthNetworkID } from "../../dist"
import { IGatewayDiscoveryParameters, VocdoniEnvironment } from "../../src"


const CONFIG_PATH = "./config.yaml"
const config = getConfig()

let pool: GatewayPool, entityAddr: string, entityWallet: Wallet, processId: string, processParams: ProcessContractParameters, processMetadata: ProcessMetadata, accounts: Account[]

async function main() {
    // Connect to a GW
    const gwPool = await connectGateways()
    pool = gwPool

    if (config.readExistingAccounts) {
        console.log("Reading account list")
        accounts = JSON.parse(readFileSync(config.accountListFilePath).toString())

        // await setEntityMetadata()
    }
    else {
        // Create from scratch
        console.log("Creating from scratch")

        // Set Entity Metadata
        await setEntityMetadata()

        // Create N wallets
        accounts = createWallets(config.numAccounts)
        assert(accounts && accounts.length)

        // Write them to a file
        writeFileSync(config.accountListFilePath, JSON.stringify(accounts, null, 2))
    }

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata
        processParams = await VotingApi.getProcessContractParameters(processId, gwPool)

        assert(processId)
        assert(processMetadata)
    }
    else {
        // Generate and publish the census
        // Get the merkle root and IPFS origin of the Merkle Tree
        console.log("Publishing census")
        const { censusRoot, censusUri } = await generatePublicCensusFromAccounts(accounts)

        // Create a new voting process
        await launchNewVote(censusRoot, censusUri)
        assert(processId)
        assert(processMetadata)
        writeFileSync(config.processInfoFilePath, JSON.stringify({ processId, processMetadata }, null, 2))

        console.log("The voting process is ready")
    }

    assert(processParams)

    console.log("- Entity Addr", processParams.entityAddress)
    console.log("- Process ID", processId)
    console.log("- Process start block", processParams.startBlock)
    console.log("- Process end block", processParams.startBlock + processParams.blockCount)
    console.log("- Process merkle root", processParams.censusRoot)
    console.log("- Process merkle tree", processParams.censusUri)
    console.log("-", accounts.length, "accounts on the census")

    // Wait until the current block >= startBlock
    await waitUntilStarted()

    // Submit votes for every account
    console.time("Voting 📩")
    await launchVotes(accounts)
    console.timeEnd("Voting 📩")

    await checkVoteResults()
}

async function connectGateways(): Promise<GatewayPool> {
    console.log("Connecting to the gateways")
    const options: IGatewayDiscoveryParameters = {
        networkId: config.ethNetworkId as EthNetworkID,
        environment: config.vocdoniEnvironment,
        bootnodesContentUri: config.bootnodesUrlRw,
        numberOfGateways: 1,
        // timeout: 10000,
    }
    const pool = await GatewayPool.discover(options)

    console.log("Connected to", pool.dvoteUri)
    console.log("Connected to", pool.provider["connection"].url)

    // WEB3 CLIENT
    entityWallet = Wallet.fromMnemonic(config.mnemonic, config.ethPath).connect(pool.provider)

    entityAddr = await entityWallet.getAddress()
    console.log("Entity Address", entityAddr)
    // console.log("Entity ID", ensHashAddress(entityAddr))

    return pool
}

async function setEntityMetadata() {
    if ((await entityWallet.getBalance()).eq(0))
        throw new Error("The account has no ether")
    console.log("Setting Metadata for entity", entityAddr)

    const metadata = JSON.parse(JSON.stringify(EntityMetadataTemplate))
    metadata.name = { default: "[Test] Entity " + Date.now() }
    metadata.description = { default: "[Test] Entity " + Date.now() }
    metadata.votingProcesses = {
        active: [],
        ended: []
    }

    await EntityApi.setMetadata(await entityWallet.getAddress(), metadata, entityWallet, pool)
    console.log("Metadata updated")

    // Read back
    const entityMetaPost = await EntityApi.getMetadata(await entityWallet.getAddress(), pool)
    assert(entityMetaPost)
    assert.strictEqual(entityMetaPost.name.default, metadata.name.default)
    assert.strictEqual(entityMetaPost.description.default, metadata.description.default)

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
            mnemonic: wallet.mnemonic.phrase,
            privateKey: wallet.privateKey,
            publicKey: compressPublicKey(wallet.publicKey),
            publicKeyDigested: CensusOffChain.Public.encodePublicKey(wallet.publicKey)
            // address: wallet.address
        })
    }

    console.log() // \n
    return accounts
}

async function generatePublicCensusFromAccounts(accounts) {
    // Create new census
    console.log("Creating a new census")

    const censusIdSuffix = require("crypto").createHash('sha256').update("" + Date.now()).digest().toString("hex")
    const claimList: { key: string, value?: string }[] = accounts.map(account => ({ key: account.publicKeyDigested, value: "" }))
    const managerPublicKeys = [compressPublicKey(entityWallet.publicKey)]

    if (config.stopOnError) {
        assert(censusIdSuffix.length == 64)
        assert(Array.isArray(claimList))
        assert(claimList.length == config.numAccounts)
        assert(Array.isArray(managerPublicKeys))
        assert(managerPublicKeys.length == 1)
    }

    // Adding claims
    console.log("Registering the new census to the Census Service")

    const { censusId } = await CensusOffChainApi.addCensus(censusIdSuffix, managerPublicKeys, entityWallet, pool)

    console.log("Adding", claimList.length, "claims")
    const { invalidClaims, censusRoot } = await CensusOffChainApi.addClaimBulk(censusId, claimList, false, entityWallet, pool)

    if (invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + invalidClaims.length)

    // Publish the census
    console.log("Publishing the new census")
    const censusUri = await CensusOffChainApi.publishCensus(censusId, entityWallet, pool)

    // Check that the census is published
    const exportedMerkleTree = await CensusOffChainApi.dumpPlain(censusId, entityWallet, pool)
    if (config.stopOnError) {
        assert(Array.isArray(exportedMerkleTree))
        assert(exportedMerkleTree.length == config.numAccounts)
    }

    // Return the census ID / Merkle Root
    return {
        censusUri,
        censusRoot
    }
}

async function launchNewVote(censusRoot, censusUri) {
    assert(censusRoot)
    assert(censusUri)
    console.log("Preparing the new vote metadata")

    const processMetadataPre: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
    processMetadataPre.title.default = "E2E process"
    processMetadataPre.description.default = "E2E process"
    processMetadataPre.questions[0].title.default = "Should 1+1 equal 2?"
    processMetadataPre.questions[0].description.default = "Description here"
    processMetadataPre.questions[0].choices[0].title.default = "Yes"
    processMetadataPre.questions[0].choices[0].value = 0
    processMetadataPre.questions[0].choices[1].title.default = "No"
    processMetadataPre.questions[0].choices[1].value = 1

    console.log("Getting the block height")
    const currentBlock = await VotingApi.getBlockHeight(pool)
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
        maxValue: 3,
        maxTotalCost: 0,
        costExponent: 10000,
        maxVoteOverwrites: 1,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    console.log("Creating the process")
    processId = await VotingApi.newProcess(processParamsPre, entityWallet, pool)
    assert(processId)

    processMetadata = processParamsPre.metadata

    // Reading back
    processParams = await VotingApi.getProcessContractParameters(processId, pool)
    assert.strictEqual(processParams.entityAddress.toLowerCase(), entityAddr.toLowerCase())
    assert.strictEqual(processParams.startBlock, processParamsPre.startBlock, "SENT " + JSON.stringify(processParamsPre) + " GOT " + JSON.stringify(processParams))
    assert.strictEqual(processParams.blockCount, processParamsPre.blockCount)
    assert.strictEqual(processParams.censusRoot, processParamsPre.censusRoot)
    assert.strictEqual(processParams.censusUri, processParamsPre.censusUri)
}

async function waitUntilStarted() {
    assert(pool)
    assert(processId)
    assert(processParams)

    await VochainWaiter.waitUntil(processParams.startBlock, pool, { verbose: true })

    console.log("Checking that the Process ID is on the list")

    let processList: string[] = await VotingApi.getProcessList({ entityId: entityAddr }, pool)
    assert(processList.length > 0)

    const trimProcId = processId.replace(/^0x/, "")
    let start = processList.length
    while (!processList.some(v => v == trimProcId)) {
        processList = await VotingApi.getProcessList({ entityId: entityAddr, from: start }, pool)
        if (!processList.length) break

        start += processList.length
    }
    assert(processList.some(v => v == trimProcId), "Process ID not present")
}

async function launchVotes(accounts) {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, pool) : null

    await Bluebird.map(accounts, async (account, idx) => {
        process.stdout.write(`Starting [${idx}] ; `)

        const wallet = new Wallet(account.privateKey)

        process.stdout.write(`Gen Proof [${idx}] ; `)
        let censusProof  = await CensusOffChainApi.generateProof(processParams.censusRoot, account.publicKeyDigested , true, pool)

            .catch(err => {
                console.error("\nCensusOffChainApi.generateProof ERR", account, err)
                if (config.stopOnError) throw err
                return null
            })
        // if (!censusProof[0] || !censusProof[1]) {
        //     console.log("error getting the census proof")
        //     return
        // } // skip when !config.stopOnError
        censusProof = censusProof as IProofGraviton
        console.log(censusProof)

        process.stdout.write(`Pkg Envelope [${idx}] ; `)
        const choices = getChoicesForVoter(idx)

        const envelope = processParams.envelopeType.hasEncryptedVotes ?
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet })

        process.stdout.write(`Sending [${idx}] ; `)
        await VotingApi.submitEnvelope(envelope, wallet, pool)
            .catch(err => {
                console.error("\nsubmitEnvelope ERR", account.publicKey, envelope, err)
                if (config.stopOnError) throw err
            })

        process.stdout.write(`Waiting [${idx}] ; `)
        await new Promise(resolve => setTimeout(resolve, 11000))

        process.stdout.write(`Checking [${idx}] ; `)
        const nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
        const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, pool)
            .catch(err => {
                console.error("\ngetEnvelopeStatus ERR", account.publicKey, nullifier, err)
                if (config.stopOnError) throw err
            }) as any

        if (config.stopOnError) assert(registered)

        process.stdout.write(`Done [${idx}] ; `)
    }, { concurrency: config.maxConcurrency })

    console.log() // \n
}

async function checkVoteResults() {
    assert.strictEqual(typeof processId, "string")

    if (config.encryptedVote) {
        console.log("Waiting a bit for the votes to be received", processId)
        const nextBlock = 2 + await VotingApi.getBlockHeight(pool)
        await VochainWaiter.waitUntil(nextBlock, pool, { verbose: true })

        console.log("Fetching the number of votes for", processId)
        const envelopeHeight = await VotingApi.getEnvelopeHeight(processId, pool)
        assert.strictEqual(envelopeHeight, config.numAccounts)

        processParams = await VotingApi.getProcessContractParameters(processId, pool)

        if (!processParams.status.isEnded) {
            console.log("Ending the process", processId)
            await VotingApi.setStatus(processId, ProcessStatus.ENDED, entityWallet, pool)

            console.log("Waiting a bit for the votes to be decrypted", processId)
            await EthWaiter.wait(12, pool, { verbose: true })
        }
    }
    console.log("Waiting a bit for the results to be ready", processId)
    const nextBlock = 3 + await VotingApi.getBlockHeight(pool)
    await VochainWaiter.waitUntil(nextBlock, pool, { verbose: true })

    console.log("Fetching the vote results for", processId)
    console.log("Results: ", JSON.stringify(await VotingApi.getResults(processId, pool),null,2))
    const totalVotes = await VotingApi.getEnvelopeHeight(processId, pool)

    // assert.strictEqual(resultsDigest.questions.length, 1)
    // assert(resultsDigest.questions[0].voteResults)

    // switch (config.votesPattern) {
    //     case "all-0":
    //         assert(resultsDigest.questions[0].voteResults.length >= 2)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes.toNumber(), config.numAccounts)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes.toNumber(), 0)
    //         break
    //     case "all-1":
    //         assert(resultsDigest.questions[0].voteResults.length >= 2)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes.toNumber(), 0)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes.toNumber(), config.numAccounts)
    //         break
    //     case "all-2":
    //         assert(resultsDigest.questions[0].voteResults.length >= 3)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes.toNumber(), 0)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes.toNumber(), 0)
    //         assert.strictEqual(resultsDigest.questions[0].voteResults[2].votes.toNumber(), config.numAccounts)
    //         break
    //     case "all-even":
    //         assert(resultsDigest.questions[0].voteResults.length >= 2)
    //         if (config.numAccounts % 2 == 0) {
    //             assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes.toNumber(), config.numAccounts / 2)
    //             assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes.toNumber(), config.numAccounts / 2)
    //         }
    //         else {
    //             assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes.toNumber(), Math.ceil(config.numAccounts / 2))
    //             assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes.toNumber(), Math.floor(config.numAccounts / 2))
    //         }
    //         break
    //     case "incremental":
    //         assert.strictEqual(resultsDigest.questions[0].voteResults.length, 2)
    //         resultsDigest.questions.forEach((question, i) => {
    //             for (let j = 0; j < question.voteResults.length; j++) {
    //                 if (i == j) assert.strictEqual(question.voteResults[j].votes.toNumber(), config.numAccounts)
    //                 else assert.strictEqual(question.voteResults[j].votes.toNumber(), 0)
    //             }
    //         })
    //         break
    //     default:
    //         throw new Error("The type of votes is unknown")
    // }

    assert.strictEqual(totalVotes, config.numAccounts)
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
    assert.strictEqual(typeof voterIdx, "number")
    assert(processMetadata)
    assert(processMetadata.questions)

    return processMetadata.questions.map((_, idx) => {
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
    assert(typeof config.vocdoniEnvironment == "string", "config.yaml > vocdoniEnvironment should be a string")
    assert(typeof config.bootnodesUrlRw == "string", "config.yaml > bootnodesUrlRw should be a string")
    assert(!config.dvoteGatewayUri || typeof config.dvoteGatewayUri == "string", "config.yaml > dvoteGatewayUri should be a string")
    assert(!config.dvoteGatewayPublicKey || typeof config.dvoteGatewayPublicKey == "string", "config.yaml > dvoteGatewayPublicKey should be a string")
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

    vocdoniEnvironment: VocdoniEnvironment
    bootnodesUrlRw: string
    dvoteGatewayUri: string
    dvoteGatewayPublicKey: string

    numAccounts: number
    maxConcurrency: number

    encryptedVote: boolean
    votesPattern: "all-0" | "all-1" | "all-2" | "all-even" | "incremental"
}

type Account = {
    idx: number,
    mnemonic: string
    privateKey: string
    publicKey: string
    publicKeyDigested: string
}
