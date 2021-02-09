import * as Bluebird from "bluebird"
import { Wallet, utils } from "ethers"
import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import * as YAML from 'yaml'
import { GatewayPool } from "../../src/net/gateway-pool"
import { EthNetworkID } from "../../src/net/gateway-bootnode"
import { EntityMetadata, EntityMetadataTemplate } from "../../src/models/entity"
import { EntityApi } from "../../src/api/entity"
import { CaBundleProtobuf, VotingApi } from "../../src/api/voting"
import { CensusCaApi } from "../../src/api/census"
import { IProofCA, ProcessMetadata, ProcessMetadataTemplate, ProofCaSignatureTypes } from "../../src/models/process"
import { ProcessContractParameters, ProcessMode, ProcessEnvelopeType, ProcessStatus, IProcessCreateParams, ProcessCensusOrigin } from "../../src/net/contracts"
import { VochainWaiter, EthWaiter } from "../../src/util/waiters"
import axios from "axios"
import { Random } from "../../src/util/random"
import { Buffer } from "buffer"
import { VocdoniEnvironment } from "../../src/models/common"
// import { DVoteGateway } from "../../src/net/gateway-dvote"

const CONFIG_PATH = "./config.yaml"
const config = getConfig()

let pool: GatewayPool, entityAddr: string, entityWallet: Wallet, processId: string, processParams: ProcessContractParameters, processMetadata: ProcessMetadata

async function main() {
    // Connect to a GW
    const gwPool = await connectGateways()
    pool = gwPool

    // Set Entity Metadata
    await setEntityMetadata()

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata
        processParams = await VotingApi.getProcessParameters(processId, gwPool)

        assert(processId)
        assert(processMetadata)
    }
    else {
        // Create a new voting process
        await launchNewVote()
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
    console.log("- Process census root", processParams.censusRoot)
    console.log("- Process census uri", processParams.censusUri)

    // Wait until the current block >= startBlock
    await waitUntilStarted()

    // Submit votes for every account
    console.time("Voting 📩")
    // await launchPlainVotes()
    await launchBlindedVotes()
    console.timeEnd("Voting 📩")

    await checkVoteResults()
}

async function connectGateways(): Promise<GatewayPool> {
    console.log("Connecting to the gateways")
    const options = {
        networkId: config.ethNetworkId as EthNetworkID,
        environment: "stg" as VocdoniEnvironment,
        bootnodesContentUri: config.bootnodesUrlRw,
        numberOfGateways: 2,
        race: false,
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

    const entityMetaPre = await EntityApi.getMetadata(await entityWallet.getAddress(), pool).catch(() => null as EntityMetadata)
    if (entityMetaPre) return entityMetaPre

    // Set new
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
    assert.strictEqual(entityMetaPost.actions.length, 1)
    assert.strictEqual(entityMetaPost.votingProcesses.active.length, 0)
    assert.strictEqual(entityMetaPost.votingProcesses.ended.length, 0)

    return entityMetaPost
}

async function launchNewVote() {
    assert(config.censusRoot)
    assert(config.censusUri)
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
    const blockCount = 2000

    const processParamsPre = {
        mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
        envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES, // bit mask
        censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA,
        metadata: ProcessMetadataTemplate,
        censusRoot: config.censusRoot,
        censusUri: config.censusUri,
        startBlock,
        blockCount,
        maxCount: 1,
        maxValue: 3,
        maxTotalCost: 0,
        uniqueValues: false,
        costExponent: 10000,
        maxVoteOverwrites: 1,
        namespace: 0,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    console.log("Creating the process")
    processId = await VotingApi.newProcess(processParamsPre, entityWallet, pool)
    assert(processId)

    console.log("Reading the process metadata back")
    const entityMetaPost = await EntityApi.getMetadata(await entityWallet.getAddress(), pool)
    assert(entityMetaPost)

    // Reading back
    processParams = await VotingApi.getProcessParameters(processId, pool)
    processMetadata = await VotingApi.getProcessMetadata(processId, pool)
    assert.strictEqual(processParams.entityAddress, entityAddr)
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

    let processList: string[] = await VotingApi.getProcessList(entityAddr, pool)
    assert(processList.length > 0)

    let lastId = processList[processList.length - 1]
    const trimProcId = processId.replace(/^0x/, "")
    while (!processList.some(v => v == trimProcId) && processList.length > 1) {
        processList = await VotingApi.getProcessList(entityAddr, pool, lastId)
        if (processList.length) {
            if (lastId == processList[processList.length - 1]) break
            lastId = processList[processList.length - 1]
        }
    }
    assert(processList.some(v => v == trimProcId))
}

async function launchPlainVotes() {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, pool) : null

    const dummyAccounts = new Array(config.numAccounts).fill(0)
    await Bluebird.map(dummyAccounts, async (_, idx: number) => {
        process.stdout.write(`Starting [${idx}] ; `)

        const wallet = Wallet.createRandom()
        const caBundle = new CaBundleProtobuf()
        caBundle.setProcessid(new Uint8Array(Buffer.from((processId).replace("0x", ""), "hex")))
        caBundle.setAddress(new Uint8Array(Buffer.from((wallet.address).replace("0x", ""), "hex")))

        const b64CaBundle = Buffer.from(caBundle.serializeBinary()).toString("base64")

        const request1 = {
            id: Random.getHex().substr(2, 10),
            request: { method: "auth", signatureType: "ECDSA" },
            signature: ""
        }
        const res1 = await axios.post(config.censusUri, request1)
        assert(res1.data.response.ok)

        const hexTokenR: string = res1.data?.response?.token
        assert(hexTokenR)

        process.stdout.write(`Get Proof [${idx}] ; `)

        const request2 = {
            id: Random.getHex().substr(2, 10),
            request: { method: "sign", "signatureType": "ECDSA", token: hexTokenR, message: b64CaBundle },
            signature: ""
        }
        const res2 = await axios.post(config.censusUri, request2)
        assert(res2.data.response.ok)
        assert(res2.data.response.caSignature)

        const hexCaSignature = res2.data.response.caSignature

        const proof: IProofCA = {
            type: ProofCaSignatureTypes.ECDSA,
            signature: hexCaSignature,
            voterAddress: wallet.address
        }

        process.stdout.write(`Pkg Envelope [${idx}] ; `)
        const choices = getChoicesForVoter(idx)

        const { envelope, signature } = processParams.envelopeType.hasEncryptedVotes ?
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof: proof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof: proof, processId, walletOrSigner: wallet })

        process.stdout.write(`Sending [${idx}] ; `)
        await VotingApi.submitEnvelope(envelope, signature, pool)
            .catch(err => {
                console.error("\nsubmitEnvelope ERR", wallet.address, envelope, signature, err)
                if (config.stopOnError) throw err
            })

        process.stdout.write(`Waiting [${idx}] ; `)
        await new Promise(resolve => setTimeout(resolve, 11000))

        process.stdout.write(`Checking [${idx}] ; `)
        const nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
        const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, pool)
            .catch(err => {
                console.error("\ngetEnvelopeStatus ERR", wallet.address, nullifier, err)
                if (config.stopOnError) throw err
            }) as any

        if (config.stopOnError) assert(registered)

        process.stdout.write(`Done [${idx}] ; `)
    }, { concurrency: config.maxConcurrency })

    console.log() // \n
}

async function launchBlindedVotes() {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, pool) : null

    const dummyAccounts = new Array(config.numAccounts).fill(0)
    await Bluebird.map(dummyAccounts, async (_, idx: number) => {
        process.stdout.write(`Starting [${idx}] ; `)

        const wallet = Wallet.createRandom()
        const caBundle = new CaBundleProtobuf()
        caBundle.setProcessid(new Uint8Array(Buffer.from((processId).replace("0x", ""), "hex")))
        caBundle.setAddress(new Uint8Array(Buffer.from((wallet.address).replace("0x", ""), "hex")))

        const hexCaBundle = utils.hexlify(caBundle.serializeBinary())
        const hexCaHashedBundle = utils.keccak256(hexCaBundle).substr(2)

        const request1 = {
            id: Random.getHex().substr(2, 10),
            request: { method: "auth", signatureType: "ECDSA_BLIND" },
            signature: ""
        }
        const res1 = await axios.post(config.censusUri, request1)
        assert(res1.data.response.ok)

        const hexTokenR: string = res1.data?.response?.token
        assert(hexTokenR)

        const tokenR = CensusCaApi.decodePoint(hexTokenR)
        const { hexBlinded, userSecretData } = CensusCaApi.blind(hexCaHashedBundle, tokenR)

        process.stdout.write(`Get Proof [${idx}] ; `)

        const request2 = {
            id: Random.getHex().substr(2, 10),
            request: { method: "sign", "signatureType": "ECDSA_BLIND", token: hexTokenR, messageHash: hexBlinded },
            signature: ""
        }
        const res2 = await axios.post(config.censusUri, request2)
        assert(res2.data.response.ok)
        assert(res2.data.response.caSignature)

        const hexBlindSignature = res2.data.response.caSignature

        const unblindedSignature = CensusCaApi.unblind(hexBlindSignature, userSecretData)
        assert(unblindedSignature)

        const proof: IProofCA = {
            type: ProofCaSignatureTypes.ECDSA_BLIND,
            signature: unblindedSignature,
            voterAddress: wallet.address
        }

        process.stdout.write(`Pkg Envelope [${idx}] ; `)
        const choices = getChoicesForVoter(idx)

        const { envelope, signature } = processParams.envelopeType.hasEncryptedVotes ?
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof: proof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof: proof, processId, walletOrSigner: wallet })

        process.stdout.write(`Sending [${idx}] ; `)
        await VotingApi.submitEnvelope(envelope, signature, pool)
            .catch(err => {
                console.error("\nsubmitEnvelope ERR", wallet.address, envelope, signature, err)
                if (config.stopOnError) throw err
            })

        process.stdout.write(`Waiting [${idx}] ; `)
        await new Promise(resolve => setTimeout(resolve, 11000))

        process.stdout.write(`Checking [${idx}] ; `)
        const nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
        const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, pool)
            .catch(err => {
                console.error("\ngetEnvelopeStatus ERR", wallet.address, nullifier, err)
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

        processParams = await VotingApi.getProcessParameters(processId, pool)

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
    const resultsDigest = await VotingApi.getResultsDigest(processId, pool)
    const totalVotes = await VotingApi.getEnvelopeHeight(processId, pool)

    assert.strictEqual(resultsDigest.questions.length, 1)
    assert(resultsDigest.questions[0].voteResults)

    switch (config.votesPattern) {
        case "all-0":
            assert(resultsDigest.questions[0].voteResults.length >= 2)
            assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes, config.numAccounts)
            assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes, 0)
            break
        case "all-1":
            assert(resultsDigest.questions[0].voteResults.length >= 2)
            assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes, 0)
            assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes, config.numAccounts)
            break
        case "all-2":
            assert(resultsDigest.questions[0].voteResults.length >= 3)
            assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes, 0)
            assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes, 0)
            assert.strictEqual(resultsDigest.questions[0].voteResults[2].votes, config.numAccounts)
            break
        case "all-even":
            assert(resultsDigest.questions[0].voteResults.length >= 2)
            if (config.numAccounts % 2 == 0) {
                assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes, config.numAccounts / 2)
                assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes, config.numAccounts / 2)
            }
            else {
                assert.strictEqual(resultsDigest.questions[0].voteResults[0].votes, Math.ceil(config.numAccounts / 2))
                assert.strictEqual(resultsDigest.questions[0].voteResults[1].votes, Math.floor(config.numAccounts / 2))
            }
            break
        case "incremental":
            assert.strictEqual(resultsDigest.questions[0].voteResults.length, 2)
            resultsDigest.questions.forEach((question, i) => {
                for (let j = 0; j < question.voteResults.length; j++) {
                    if (i == j) assert.strictEqual(question.voteResults[j].votes, config.numAccounts)
                    else assert.strictEqual(question.voteResults[j].votes, 0)
                }
            })
            break
        default:
            throw new Error("The type of votes is unknown")
    }

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
    assert(typeof config.readExistingProcess == "boolean", "config.yaml > readExistingProcess should be a boolean")
    assert(typeof config.stopOnError == "boolean", "config.yaml > stopOnError should be a boolean")
    assert(typeof config.processInfoFilePath == "string", "config.yaml > processInfoFilePath should be a string")
    assert(typeof config.censusRoot == "string", "config.yaml > processInfoFilePath should be a string")
    assert(typeof config.censusUri == "string", "config.yaml > censusUri should be a string")
    assert(typeof config.mnemonic == "string", "config.yaml > mnemonic should be a string")
    assert(config.mnemonic, "config.yaml > Please, set the mnemonic to use")
    assert(typeof config.ethPath == "string", "config.yaml > ethPath should be a string")
    assert(typeof config.ethNetworkId == "string", "config.yaml > ethNetworkId should be a string")
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
    readExistingProcess: boolean
    stopOnError: boolean

    processInfoFilePath: string

    censusRoot: string,
    censusUri: string,

    mnemonic: string
    ethPath: string
    ethNetworkId: string

    bootnodesUrlRw: string
    dvoteGatewayUri: string
    dvoteGatewayPublicKey: string

    numAccounts: number
    maxConcurrency: number

    encryptedVote: boolean
    votesPattern: "all-0" | "all-1" | "all-2" | "all-even" | "incremental"
}
