import * as Bluebird from "bluebird"
import { Wallet, utils, providers } from "ethers"
import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import * as YAML from 'yaml'
import {
    EntityApi,
    VotingApi,
    CensusOffChainApi,
    CensusErc20Api,
    GatewayPool,
    EthNetworkID,
    EntityMetadataTemplate,
    ProcessMetadata, ProcessMetadataTemplate,
    ProcessContractParameters, ProcessMode, ProcessEnvelopeType, ProcessStatus, IProcessCreateParams, ProcessCensusOrigin,
    VochainWaiter, EthWaiter
} from "../.."


const CONFIG_PATH = "./config.yaml"
const config = getConfig(CONFIG_PATH)

let pool: GatewayPool, creatorWallet: Wallet, processId: string, processParams: ProcessContractParameters, processMetadata: ProcessMetadata, accounts: Account[]

async function main() {
    console.log("Reading account list")
    accounts = config.privKeys.map((key, i) => {
        const wallet = new Wallet(key)
        return {
            idx: i,
            privateKey: key,
            publicKey: wallet.publicKey,
            publicKeyHash: CensusOffChainApi.digestHexClaim(wallet.publicKey)
        }
    })

    // Connect to a GW
    const gwPool = await connectGateways(accounts)
    pool = gwPool

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
    console.log("- Process merkle root", processParams.censusMerkleRoot)
    console.log("- Process merkle tree", processParams.censusMerkleTree)
    console.log("-", accounts.length, "accounts on the census")

    // Wait until the current block >= startBlock
    await waitUntilStarted()

    // Submit votes for every account
    console.time("Voting 📩")
    await submitVotes(accounts)
    console.timeEnd("Voting 📩")

    await checkVoteResults()
}

async function connectGateways(accounts: Account[]): Promise<GatewayPool> {
    console.log("Connecting to the gateways")
    const options = {
        networkId: config.ethNetworkId as EthNetworkID,
        bootnodesContentUri: config.bootnodesUrlRw,
        numberOfGateways: 2,
        race: false,
        // timeout: 10000,
    }
    const pool = await GatewayPool.discover(options)

    console.log("Connected to", await pool.dvoteUri)
    console.log("Connected to", pool.provider["connection"].url)

    // WEB3 CLIENT
    creatorWallet = new Wallet(accounts[0].privateKey).connect(pool.provider)

    console.log("Entity Address", config.tokenAddress)

    return pool
}

async function launchNewVote() {
    console.log("Computing the storage proof of creator the account")

    const blockNumber = await pool.provider.getBlockNumber()

    if (!await CensusErc20Api.isRegistered(config.tokenAddress, pool)) {
        const balanceSlot = CensusErc20Api.getHolderBalanceSlot(creatorWallet.address, config.tokenBalanceMappingPosition)
        const result = await CensusErc20Api.generateProof(config.tokenAddress, [balanceSlot], blockNumber, pool.provider as providers.JsonRpcProvider)
        const { proof, block, blockHeaderRLP, accountProofRLP, storageProofsRLP } = result

        await CensusErc20Api.registerToken(config.tokenAddress,
            config.tokenBalanceMappingPosition,
            blockNumber,
            Buffer.from(blockHeaderRLP.replace("0x", ""), "hex"),
            Buffer.from(accountProofRLP.replace("0x", ""), "hex"),
            creatorWallet,
            pool)

        assert(await CensusErc20Api.isRegistered(config.tokenAddress, pool))
    }

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
    const startBlock = currentBlock + 35
    const blockCount = 60480

    const processParamsPre: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata } = {
        mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
        envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES, // bit mask
        censusOrigin: ProcessCensusOrigin.ERC20,
        metadata: ProcessMetadataTemplate,
        startBlock,
        blockCount,
        maxCount: 1,
        maxValue: 3,
        maxTotalCost: 0,
        costExponent: 10000,
        maxVoteOverwrites: 1,
        evmBlockHeight: blockNumber,
        tokenAddress: config.tokenAddress,
        namespace: 0,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    console.log("Creating the process")
    processId = await VotingApi.newProcess(processParamsPre, creatorWallet, pool)
    assert(processId)

    console.log("Reading the process metadata back")
    const entityMetaPost = await EntityApi.getMetadata(await creatorWallet.getAddress(), pool)
    assert(entityMetaPost)

    // Reading back
    processParams = await VotingApi.getProcessParameters(processId, pool)
    processMetadata = await VotingApi.getProcessMetadata(processId, pool)
    assert.equal(processParams.entityAddress, config.tokenAddress)
    assert.equal(processParams.startBlock, processParamsPre.startBlock, "SENT " + JSON.stringify(processParamsPre) + " GOT " + JSON.stringify(processParams))
    assert.equal(processParams.blockCount, processParamsPre.blockCount)
    assert.equal(processParams.censusMerkleRoot, processParamsPre.censusMerkleRoot)
    assert.equal(processParams.censusMerkleTree, processParamsPre.censusMerkleTree)
}

async function waitUntilStarted() {
    assert(pool)
    assert(processId)
    assert(processParams)

    await VochainWaiter.waitUntil(processParams.startBlock, pool, { verbose: true })

    console.log("Checking that the Process ID is on the list")

    let processList: string[] = await VotingApi.getProcessList(config.tokenAddress, pool)
    assert(processList.length > 0)

    let lastId = processList[processList.length - 1]
    const trimProcId = processId.replace(/^0x/, "")
    while (!processList.some(v => v == trimProcId) && processList.length > 1) {
        processList = await VotingApi.getProcessList(config.tokenAddress, pool, lastId)
        if (processList.length) {
            if (lastId == processList[processList.length - 1]) break
            lastId = processList[processList.length - 1]
        }
    }
    assert(processList.some(v => v == trimProcId))
}

async function submitVotes(accounts: Account[]) {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, pool) : null

    await Bluebird.map(accounts, async (account: Account, idx: number) => {
        process.stdout.write(`Starting [${idx}] ; `)

        const wallet = new Wallet(account.privateKey)

        process.stdout.write(`Gen Proof [${idx}] ; `)
        const merkleProof = await CensusOffChainApi.generateProof(processParams.censusMerkleRoot, account.publicKeyHash, true, pool)
            .catch(err => {
                console.error("\nCensusApi.generateProof ERR", account, err)
                if (config.stopOnError) throw err
                return null
            })
        if (!merkleProof) return // skip when !config.stopOnError

        process.stdout.write(`Pkg Envelope [${idx}] ; `)
        const choices = [0]

        const { envelope, signature } = processParams.envelopeType.hasEncryptedVotes ?
            await VotingApi.packageSignedEnvelope({ votes: choices, merkleProof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ votes: choices, merkleProof, processId, walletOrSigner: wallet })

        process.stdout.write(`Sending [${idx}] ; `)
        await VotingApi.submitEnvelope(envelope, signature, pool)
            .catch(err => {
                console.error("\nsubmitEnvelope ERR", account.publicKey, envelope, signature, err)
                if (config.stopOnError) throw err
            })

        process.stdout.write(`Waiting [${idx}] ; `)
        await new Promise(resolve => setTimeout(resolve, 11000))

        process.stdout.write(`Checking [${idx}] ; `)
        const nullifier = await VotingApi.getSignedVoteNullifier(wallet.address, processId)
        const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, pool)
            .catch(err => {
                console.error("\ngetEnvelopeStatus ERR", account.publicKey, nullifier, err)
                if (config.stopOnError) throw err
            }) as any

        if (config.stopOnError) assert(registered)

        process.stdout.write(`Done [${idx}] ; `)
    }, { concurrency: 1000 })

    console.log() // \n
}

async function checkVoteResults() {
    assert.equal(typeof processId, "string")

    if (config.encryptedVote) {
        console.log("Waiting a bit for the votes to be received", processId)
        const nextBlock = 2 + await VotingApi.getBlockHeight(pool)
        await VochainWaiter.waitUntil(nextBlock, pool, { verbose: true })

        console.log("Fetching the number of votes for", processId)
        const envelopeHeight = await VotingApi.getEnvelopeHeight(processId, pool)
        assert.equal(envelopeHeight, config.privKeys.length)

        processParams = await VotingApi.getProcessParameters(processId, pool)

        if (!processParams.status.isEnded) {
            console.log("Ending the process", processId)
            await VotingApi.setStatus(processId, ProcessStatus.ENDED, creatorWallet, pool)

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

    assert.equal(resultsDigest.questions.length, 1)
    assert(resultsDigest.questions[0].voteResults)

    // all-0
    assert(resultsDigest.questions[0].voteResults.length >= 2)
    assert.equal(resultsDigest.questions[0].voteResults[0].votes, config.privKeys.length)
    assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)

    assert.equal(totalVotes, config.privKeys.length)
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

function getConfig(path: string): Config {
    const config: Config = YAML.parse(readFileSync(path).toString())
    assert(typeof config == "object", "The config file appears to be invalid")
    assert(typeof config.readExistingProcess == "boolean", "config.yaml > readExistingProcess should be a boolean")
    assert(typeof config.stopOnError == "boolean", "config.yaml > stopOnError should be a boolean")
    assert(typeof config.processInfoFilePath == "string", "config.yaml > processInfoFilePath should be a string")
    assert(typeof config.ethNetworkId == "string", "config.yaml > ethNetworkId should be a string")
    assert(typeof config.tokenAddress == "string", "config.yaml > tokenAddress should be a string")
    assert(typeof config.tokenBalanceMappingPosition == "number", "config.yaml > tokenBalanceMappingPosition should be a number")
    assert(Array.isArray(config.privKeys) && config.privKeys.length, "config.yaml > privKeys should be an array of strings")
    assert(typeof config.bootnodesUrlRw == "string", "config.yaml > bootnodesUrlRw should be a string")
    assert(!config.dvoteGatewayUri || typeof config.dvoteGatewayUri == "string", "config.yaml > dvoteGatewayUri should be a string")
    assert(!config.dvoteGatewayPublicKey || typeof config.dvoteGatewayPublicKey == "string", "config.yaml > dvoteGatewayPublicKey should be a string")
    assert(typeof config.encryptedVote == "boolean", "config.yaml > encryptedVote should be a boolean")
    return config
}

type Config = {
    readExistingProcess: boolean
    stopOnError: boolean

    processInfoFilePath: string

    ethNetworkId: string
    tokenAddress: string
    tokenBalanceMappingPosition: number
    privKeys: string[]

    bootnodesUrlRw: string
    dvoteGatewayUri: string
    dvoteGatewayPublicKey: string

    encryptedVote: boolean
}

type Account = {
    idx: number,
    privateKey: string
    publicKey: string
    publicKeyHash: string
}
