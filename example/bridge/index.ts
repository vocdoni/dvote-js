import * as Bluebird from "bluebird"
import { Wallet, utils, providers } from "ethers"
import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import * as YAML from 'yaml'
import {
    VotingApi,
    CensusOffChainApi,
    CensusErc20Api,
    GatewayPool,
    Gateway, GatewayInfo,
    EthNetworkID,
    EntityMetadataTemplate,
    ProcessMetadata, ProcessMetadataTemplate,
    ProcessContractParameters, ProcessMode, ProcessEnvelopeType, ProcessStatus, IProcessCreateParams, ProcessCensusOrigin,
    VochainWaiter, EthWaiter,
    compressPublicKey,
    VocdoniEnvironment
} from "../../src"
// import { Buffer } from "buffer/"


const CONFIG_PATH = "./config.yaml"
const config = getConfig(CONFIG_PATH)

let pool: GatewayPool | Gateway, creatorWallet: Wallet, processId: string, processParams: ProcessContractParameters, processMetadata: ProcessMetadata, accounts: Account[]

async function main() {
    console.log("Reading account list")
    accounts = config.privKeys.map((key, i) => {
        const wallet = new Wallet(key)
        return {
            idx: i,
            privateKey: key,
            publicKey: compressPublicKey(wallet.publicKey),
            publicKeyHash: CensusOffChainApi.digestPublicKey(wallet.publicKey)
        }
    })

    // Connect to a GW
    pool = await connectGateways(accounts)

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata
        processParams = await VotingApi.getProcessParameters(processId, pool)

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
    console.log("- Process merkle root", processParams.censusRoot)
    console.log("- Process merkle tree", processParams.censusUri)
    console.log("-", accounts.length, "accounts on the census")

    // Wait until the current block >= startBlock
    await waitUntilStarted()

    // Submit votes for every account
    console.time("Voting 📩")
    await submitVotes(accounts)
    console.timeEnd("Voting 📩")

    await checkVoteResults()
}

async function connectGateways(accounts: Account[]): Promise<GatewayPool | Gateway> {
    console.log("Connecting to the gateways")
    let gw: GatewayPool | Gateway

    if (config.dvoteGatewayUri && config.web3Uri) {
        const info = new GatewayInfo(config.dvoteGatewayUri, ["census", "file", "results", "vote"], config.web3Uri, config.dvoteGatewayPublicKey || "")
        gw = await Gateway.fromInfo(info, config.vocdoniEnvironment)
    }
    else {
        const options = {
            networkId: config.ethNetworkId as EthNetworkID,
            bootnodesContentUri: config.bootnodesUrlRw,
            numberOfGateways: 2,
            race: false,
            // timeout: 10000,
        }
        gw = await GatewayPool.discover(options)
    }
    await gw.init()

    console.log("Connected to", gw.dvoteUri)
    console.log("Connected to", gw.provider["connection"].url)

    // WEB3 CLIENT
    creatorWallet = new Wallet(accounts[0].privateKey).connect(gw.provider)

    const balance = await creatorWallet.getBalance()
    if (balance.isZero()) throw new Error("The first account of the list has no ether balance\n" + creatorWallet.address)

    console.log("Token Address", config.tokenAddress)

    return gw
}

async function launchNewVote() {
    console.log("Computing the storage proof of creator the account")

    const blockNumber = await pool.provider.getBlockNumber()
    const balanceSlot = CensusErc20Api.getHolderBalanceSlot(creatorWallet.address, config.tokenBalanceMappingPosition)
    const result = await CensusErc20Api.generateProof(config.tokenAddress, [balanceSlot], blockNumber, pool.provider as providers.JsonRpcProvider)
    const { proof, block, blockHeaderRLP, accountProofRLP, storageProofsRLP } = result

    if (!await CensusErc20Api.isRegistered(config.tokenAddress, pool)) {
        // TODO: Check the conversion of storageProofsRLP into storageProof as a buffer
        const storageProof = Buffer.from(storageProofsRLP[0].replace("0x", ""), "hex")

        // const storageProof = await this.verifyProof(storageRoot, Buffer.from(path, 'hex'), storageProof.proof)

        await CensusErc20Api.registerToken(
            config.tokenAddress,
            config.tokenBalanceMappingPosition,
            blockNumber,
            Buffer.from(blockHeaderRLP.replace("0x", ""), "hex"),
            Buffer.from(accountProofRLP.replace("0x", ""), "hex"),
            storageProof, // flatten
            creatorWallet,
            pool
        )

        assert(await CensusErc20Api.isRegistered(config.tokenAddress, pool))
    }

    console.log("Preparing the new vote metadata")

    const processMetadataPre: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
    processMetadataPre.title.default = "Bridge Process"
    processMetadataPre.description.default = "This is the description of the testing bridge end to end process. It is very important that you read carefully the text below."
    processMetadataPre.questions[0].title.default = "What's your feeling about the Aragon - Vocdoni deal?"
    processMetadataPre.questions[0].description.default = "Are you happy and proud of the new adventure that we are undertaking?"
    processMetadataPre.questions[0].choices[0].title.default = "I'm so happy"
    processMetadataPre.questions[0].choices[0].value = 0
    processMetadataPre.questions[0].choices[1].title.default = "Not sure"
    processMetadataPre.questions[0].choices[1].value = 1
    processMetadataPre.questions[0].choices.push({
        title: { default: "Not really" },
        value: 2
    })

    console.log("Getting the block height")
    const currentBlock = await VotingApi.getBlockHeight(pool)
    const startBlock = currentBlock + 25
    // const blockCount = 6 * 60 * 24 * 10
    const blockCount = 6 * 10 // 10m
    // const blockCount = 15

    // TODO: COMPUTE THE PARAMS SIGNATURE
    // TODO: INCLUDE THE BALANCE SLOT IN SUCH SIGNATURE

    const processParamsPre: Omit<Omit<IProcessCreateParams, "metadata">, "questionCount"> & { metadata: ProcessMetadata } = {
        mode: ProcessMode.make({ autoStart: true }),
        envelopeType: ProcessEnvelopeType.make({}), // bit mask
        censusOrigin: ProcessCensusOrigin.ERC20,
        metadata: processMetadataPre,
        censusRoot: proof.storageHash,
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

    // Reading back
    processParams = await VotingApi.getProcessParameters(processId, pool)
    processMetadata = await VotingApi.getProcessMetadata(processId, pool)
    assert.equal(processParams.entityAddress, config.tokenAddress)
    assert.equal(processParams.startBlock, processParamsPre.startBlock, "SENT " + JSON.stringify(processParamsPre) + " GOT " + JSON.stringify(processParams))
    assert.equal(processParams.blockCount, processParamsPre.blockCount)
    assert.equal(processParams.censusRoot, processParamsPre.censusRoot)
}

async function waitUntilStarted() {
    assert(pool)
    assert(processId)
    assert(processParams)

    await VochainWaiter.waitUntil(processParams.startBlock, pool, { verbose: true })

    console.log("Checking that the Process ID is on the list")

    let processList: string[] = await VotingApi.getProcessList({ entityId: config.tokenAddress }, pool)
    assert(processList.length > 0)

    const trimProcId = processId.replace(/^0x/, "")
    let start = processList.length
    while (!processList.some(v => v == trimProcId)) {
        processList = await VotingApi.getProcessList({ entityId: config.tokenAddress, from: start }, pool)
        if (!processList.length) break

        start += processList.length
    }
    assert(processList.some(v => v == trimProcId), "Process ID not present")
}

async function submitVotes(accounts: Account[]) {
    console.log("Launching votes")

    const processKeys = processParams.envelopeType.hasEncryptedVotes ? await VotingApi.getProcessKeys(processId, pool) : null
    const balanceMappingPosition = await CensusErc20Api.getBalanceMappingPosition(config.tokenAddress, pool)

    await Bluebird.map(accounts, async (account: Account, idx: number) => {
        process.stdout.write(`Starting [${idx}] ; `)

        const wallet = new Wallet(account.privateKey)

        process.stdout.write(`Gen Proof [${idx}] ; `)

        const balanceSlot = CensusErc20Api.getHolderBalanceSlot(wallet.address, balanceMappingPosition.toNumber())
        const result = await CensusErc20Api.generateProof(config.tokenAddress, [balanceSlot], processParams.evmBlockHeight, pool.provider as providers.JsonRpcProvider)

        process.stdout.write(`Pkg Envelope [${idx}] ; `)

        const choices = [0]
        const censusProof = result.proof.storageProof[0]

        const { envelope, signature } = processParams.envelopeType.hasEncryptedVotes ?
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet, processKeys }) :
            await VotingApi.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet })

        process.stdout.write(`Sending [${idx}] ; `)
        await VotingApi.submitEnvelope(envelope, signature, pool)
            .catch(err => {
                console.error("\nsubmitEnvelope ERR", account.publicKey, err)
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

        console.log("Waiting for the process to end", processId)
        await VochainWaiter.waitUntil(processParams.startBlock + processParams.blockCount, pool, { verbose: true })
    }
    console.log("Waiting a bit for the results to be ready", processId)
    await VochainWaiter.wait(5, pool, { verbose: true })

    console.log("Fetching the vote results for", processId)
    const resultsDigest = await VotingApi.getResultsDigest(processId, pool)
    const totalVotes = await VotingApi.getEnvelopeHeight(processId, pool)

    assert.equal(resultsDigest.questions.length, 1)
    assert(resultsDigest.questions[0].voteResults)

    // all-0
    assert(resultsDigest.questions[0].voteResults.length >= 2)
    assert.equal(resultsDigest.questions[0].voteResults[0].votes, config.privKeys.length)
    assert.equal(resultsDigest.questions[0].voteResults[1].votes, 0)

    // assert.equal(totalVotes, config.privKeys.length)
    assert.equal(totalVotes, 2800000000000000000)
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
    assert(typeof config.vocdoniEnvironment == "string", "config.yaml > vocdoniEnvironment should be a string")
    assert(typeof config.tokenAddress == "string", "config.yaml > tokenAddress should be a string")
    assert(typeof config.tokenBalanceMappingPosition == "number", "config.yaml > tokenBalanceMappingPosition should be a number")
    assert(Array.isArray(config.privKeys) && config.privKeys.length, "config.yaml > privKeys should be an array of strings")
    assert(typeof config.bootnodesUrlRw == "string", "config.yaml > bootnodesUrlRw should be a string")
    assert(!config.dvoteGatewayUri || typeof config.dvoteGatewayUri == "string", "config.yaml > dvoteGatewayUri should be a string")
    assert(!config.dvoteGatewayPublicKey || typeof config.dvoteGatewayPublicKey == "string", "config.yaml > dvoteGatewayPublicKey should be a string")
    assert(!config.web3Uri || typeof config.web3Uri == "string", "config.yaml > web3Uri should be a string")
    assert(typeof config.encryptedVote == "boolean", "config.yaml > encryptedVote should be a boolean")
    return config
}

type Config = {
    readExistingProcess: boolean
    stopOnError: boolean

    processInfoFilePath: string

    ethNetworkId: string
    vocdoniEnvironment: VocdoniEnvironment
    tokenAddress: string
    tokenBalanceMappingPosition: number
    privKeys: string[]

    bootnodesUrlRw: string
    dvoteGatewayUri: string
    dvoteGatewayPublicKey: string
    web3Uri: string

    encryptedVote: boolean
}

type Account = {
    idx: number,
    privateKey: string
    publicKey: string
    publicKeyHash: string
}
