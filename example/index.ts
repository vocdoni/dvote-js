import axios from "axios"

console.log("Reading .env (if present)...")
import { config } from 'dotenv'

config({ path: __dirname + "/.env" })

import * as fs from "fs"
import { utils, providers, Wallet } from "ethers"
import { WalletUtil } from "../src/util/signers"
import { FileApi } from "../src/api/file"
import { EntityApi } from "../src/api/entity"
import { VotingApi } from "../src/api/voting"
import { CensusApi } from "../src/api/census"
import { ProcessContractParameters } from "../src/net/contracts"
import { Gateway } from "../src/net/gateway"
import { DVoteGateway } from "../src/net/gateway-dvote"
import { Web3Gateway } from "../src/net/gateway-web3"
import { GatewayPool } from "../src/net/gateway-pool"
import { GatewayBootnode } from "../src/net/gateway-bootnode"
import { EntityMetadataTemplate, EntityMetadata, TextRecordKeys } from "../src/models/entity"
import { ProcessMetadata, ProcessMetadataTemplate } from "../src/models/process"
import { GatewayInfo } from "../src/wrappers/gateway-info"
import { VOCHAIN_BLOCK_TIME } from "../src/constants"
import { JsonSignature, BytesSignature } from "../src/util/data-signing"
import { DVoteGatewayMethod } from "../src/models/gateway"
import { IGatewayDiscoveryParameters } from "../src/net/gateway-discovery"
import { ProcessEnvelopeType, ProcessMode, ProcessStatus, ProcessCensusOrigin, ensHashAddress } from "../src/net/contracts"
import { ContentHashedUri } from "../src/wrappers/content-hashed-uri"

const { Buffer } = require("buffer/")

const MNEMONIC = process.env.MNEMONIC || "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_PUB_KEY = process.env.GATEWAY_PUB_KEY || "02325f284f50fa52d53579c7873a480b351cc20f7780fa556929f5017283ad2449"
const GATEWAY_DVOTE_URI = process.env.GATEWAY_DVOTE_URI || "wss://myhost/dvote"
const GATEWAY_WEB3_URI = process.env.GATEWAY_WEB3_URI || "https://sokol.poa.network"

const NETWORK_ID = "sokol"
const WALLET_SEED = process.env.WALLET_SEED
const WALLET_PASSPHRASE = process.env.WALLET_PASSPHRASE
const BOOTNODES_URL_RO = "https://bootnodes.vocdoni.net/gateways.json"
const BOOTNODES_URL_RW = "https://bootnodes.vocdoni.net/gateways.dev.json"

// const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

async function attachToEntityResolver() {
    // const gw = await Gateway.randomFromDefault(NETWORK_ID)
    const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)
    await gw.init()

    console.log("Attaching to contract...")
    const resolverInstance = await gw.getEnsPublicResolverInstance(wallet)

    const myEntityAddress = await wallet.getAddress()
    const entityEnsNode = ensHashAddress(myEntityAddress)

    console.log("Entity Address:", myEntityAddress)
    console.log("Entity NODE:", entityEnsNode)

    const tx = await resolverInstance.setText(entityEnsNode, TextRecordKeys.VOCDONI_BOOT_NODES, "https://bootnodes.vocdoni.net/gateways.json")
    await tx.wait()
    console.log("Reading", TextRecordKeys.VOCDONI_BOOT_NODES)
    const val = await resolverInstance.text(entityEnsNode, TextRecordKeys.VOCDONI_BOOT_NODES)
    console.log("Value stored on the blockchain:", val)
}

async function attachToVotingProcess() {
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    // const gw = await Gateway.randomFromDefault(NETWORK_ID)
    const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)
    await gw.init()

    console.log("Attaching to contract at from")
    const processInstance = await gw.getProcessesInstance(wallet)

    console.log("Reading the namespace contract address")
    let val = await processInstance.namespaceAddress()
    console.log("Value stored on the blockchain:", val)
}

async function checkGatewayStatus() {
    try {
        // const gw = await Gateway.randomFromDefault(NETWORK_ID)
        const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)

        const status = await gw.getGatewayInfo()
        console.log("Gateway status", status)
    }
    catch (err) {
        console.error("The gateway can't be reached", err)
    }
}

async function fileUpload() {
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

        // const dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file"], publicKey: GATEWAY_PUB_KEY })
        const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)
        await gw.init()

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        console.error("PUTTING STRING OF LENGTH: ", strData.length)
        const origin = await FileApi.add(Buffer.from(strData), "mobile-org-web-action-example.html", wallet, gw)
        console.log("DATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await FileApi.fetchString(origin, gw)
        console.log("DATA:", data)
    } catch (err) {
        console.error(err)
    }
}

async function fileDownload(hash) {
    try {
        // const gw = await Gateway.randomFromDefault(NETWORK_ID)
        const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)
        await gw.init()

        const data = await FileApi.fetchString(hash, gw)
        console.log("DATA:", JSON.stringify(JSON.parse(data), null, 2))

    } catch (err) {
        console.error(err)
    }
}

async function emptyFeedUpload() {
    const feed = {
        "version": "https://jsonfeed.org/version/1",
        "title": "News Feed",
        "home_page_url": "",
        "description": "",
        "feed_url": "",
        "icon": "",
        "favicon": "",
        "expired": false,
        "items": []
    }
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
        // const gw = await Gateway.randomFromDefault(NETWORK_ID)
        const gw = await Gateway.randomfromUri(NETWORK_ID, BOOTNODES_URL_RO)
        await gw.init()

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = JSON.stringify(feed)
        console.error("PUTTING STRING OF LENGTH: ", strData.length)
        const origin = await FileApi.add(Buffer.from(strData), "feed-template.json", wallet, gw)
        console.log("DATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await FileApi.fetchString(origin, gw)
        console.log("DATA:", data)

    } catch (err) {
        console.error(err)
    }
}

async function registerEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    // const wallet = WalletUtil.fromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)

    const myEntityAddress = await wallet.getAddress()
    const entityEnsNode = ensHashAddress(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity NODE", entityEnsNode)

    // const pool = await GatewayPool.discover({ networkId: "goerli" })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "http://bootnodes.vocdoni.net/gateways.dev.json" })
    await pool.init()

    const entityMetadata = Object.assign({}, EntityMetadataTemplate, { name: { default: "TEST ENTITY" } })
    const contentUri = await EntityApi.setMetadata(myEntityAddress, entityMetadata, wallet, pool)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)
}

async function readEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    // const wallet = WalletUtil.fromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)

    const myEntityAddress = await wallet.getAddress()

    console.log("Entity Addr", myEntityAddress)
    // console.log("Entity Node:", ensHashAddress(myEntityAddress))
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const meta = await EntityApi.getMetadata(myEntityAddress, pool)
    console.log("JSON METADATA\n", meta)
}

async function updateEntityInfo() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    console.log("UPDATING ENTITY NODE:", ensHashAddress(myEntityAddress))
    const meta = await EntityApi.getMetadata(myEntityAddress, pool)

    await EntityApi.setMetadata(myEntityAddress, meta, wallet, pool)
    console.log("updated")
}

async function censusMethods() {
    // SIGNED
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    // const dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file", "census"], publicKey: GATEWAY_PUB_KEY })
    // const gw = new Gateway(dvoteGw, null)
    // await gw.init()

    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const censusName = "My census name " + Math.random().toString().substr(2)
    const adminPublicKeys = [wallet["_signingKey"]().publicKey]
    const publicKeyClaims = [
        Buffer.from("0212d6dc30db7d2a32dddd0ba080d244cc26fcddcc29beb3fcb369564b468b49f1", "hex").toString("base64"),
        Buffer.from("033980b22e9432aa2884772570c47a6f78a39bcc08b428161a503eeb91f66b1901", "hex").toString("base64"),
        Buffer.from("03f64bd4dc997f1eed4f20843730c13d926199ff45a9edfad191feff0cea6e3d54", "hex").toString("base64"),
        Buffer.from("02b9bd5b6f90833586cfcd181d1abe66d14152bb100ed7ec63ff94ecfe48dab187", "hex").toString("base64")
    ]
    console.log(publicKeyClaims);

    // Create a census if it doesn't exist
    let result1 = await CensusApi.addCensus(censusName, adminPublicKeys, wallet, pool)
    console.log(`ADD CENSUS "${censusName}" RESULT:`, result1)

    // Add a claim to the new census
    const censusId = result1.censusId
    let result2 = await CensusApi.addClaim(censusId, publicKeyClaims[0], false, wallet, pool)
    console.log("ADDED", publicKeyClaims[0], "TO", censusId)

    // Add claims to the new census
    let result3 = await CensusApi.addClaimBulk(censusId, publicKeyClaims.slice(1), false, wallet, pool)
    console.log("ADDED", publicKeyClaims.slice(1), "TO", censusId)
    if (result3.invalidClaims.length > 0) console.log("INVALID CLAIMS", result3.invalidClaims)

    const merkleRoot = await CensusApi.getRoot(censusId, pool)
    console.log("MERKLE ROOT", merkleRoot)  // 0x....

    const merkleTree = await CensusApi.publishCensus(censusId, wallet, pool)
    console.log("PUBLISHED", censusId)
    console.log(merkleTree)   // ipfs://....

    let result4 = await CensusApi.dump(censusId, wallet, pool)
    console.log("DUMP", result4)

    let result5 = await CensusApi.dumpPlain(censusId, wallet, pool)
    console.log("DUMP PLAIN", result5)
}

async function createProcessRaw() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    // const dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file"], publicKey: GATEWAY_PUB_KEY })
    // const web3Gw = new Web3Gateway(provider)
    // const gw = new Gateway(dvoteGw, web3Gw)
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    console.log("Attaching to contract")
    const processesInstance = await pool.getProcessesInstance(wallet)

    console.log("Uploading metadata...")
    const processMetadata = Object.assign({}, ProcessMetadataTemplate, { startBlock: 20000 })
    const strData = JSON.stringify(processMetadata)
    const origin = await FileApi.add(Buffer.from(strData), "process-metadata.json", wallet, pool)
    console.log("process-metadata.json\nDATA STORED ON:", origin)

    const metaCuri = new ContentHashedUri(origin)
    metaCuri.setHashFrom(strData)

    const censusCuri = new ContentHashedUri("http://localhost/")
    censusCuri.setHashFrom("")

    console.log("Creating process with parameters:", metaCuri.toString(), "0x0", censusCuri.toString())

    // The contract expects a tuple, using a wrapper for convenience
    const params = ProcessContractParameters.fromParams({
        mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
        envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES | ProcessEnvelopeType.SERIAL | ProcessEnvelopeType.UNIQUE_VALUES, // bit mask
        censusOrigin: ProcessCensusOrigin.OFF_CHAIN,
        metadata: metaCuri.toString(),
        censusMerkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
        censusMerkleTree: censusCuri.toString(),
        startBlock: 500,
        blockCount: 1000,
        questionCount: 5,
        maxCount: 1,
        maxValue: 3,
        maxTotalCost: 0,
        costExponent: 10000,
        maxVoteOverwrites: 1,
        namespace: 0,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    })
    const tx = await processesInstance.newProcess(...params.toContractParams())
    const result = await tx.wait()
    console.log("RESULT", result)
}

async function createProcessFull() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    // const wallet = WalletUtil.fromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()

    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const entityMetaPre = await EntityApi.getMetadata(myEntityAddress, pool)

    const processMetadata: ProcessMetadata = {
        "version": "1.1",
        "title": { "default": "Board election" },
        "description": {
            "default": ""
        },
        "media": {
            "header": "https://ipfs.io/ipfs/1234...",
            "streamUri": ""
        },
        "questions": [
            {
                "title": { "default": "CEO" },
                "description": { "default": "Chief Executive Officer" },
                "choices": [
                    { "title": { "default": "Yellow list" }, "value": 0 },
                    { "title": { "default": "Pink list" }, "value": 1 },
                    { "title": { "default": "Abstention" }, "value": 2 },
                    { "title": { "default": "White vote" }, "value": 3 }
                ]
            },
            {
                "title": { "default": "CFO" },
                "description": { "default": "Chief Financial Officer" },
                "choices": [
                    { "title": { "default": "Yellow list" }, "value": 0 },
                    { "title": { "default": "Pink list" }, "value": 1 },
                    { "title": { "default": "Abstention" }, "value": 2 },
                    { "title": { "default": "White vote" }, "value": 3 }
                ]
            },
        ]
    }

    const params = {
        mode: ProcessMode.make({ autoStart: true }),
        envelopeType: ProcessEnvelopeType.make({ encryptedVotes: true }),
        censusOrigin: ProcessCensusOrigin.OFF_CHAIN,
        metadata: processMetadata,
        startBlock: 100,
        blockCount: 1000,
        censusMerkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
        censusMerkleTree: "ipfs://1234",
        maxCount: 1,
        questionCount: 2,
        costExponent: 1000,
        namespace: 1,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000",
        uniqueValues: true,
        maxValue: 5,
        maxTotalCost: 0,
        maxVoteOverwrites: 1
    }

    const processId = await VotingApi.newProcess(params, wallet.connect(pool.provider), pool)
    const entityMetaPost = await EntityApi.getMetadata(myEntityAddress, pool)

    console.log("CREATED", processId)

    // READING BACK:
    const metadata = await VotingApi.getProcessMetadata(processId, pool)
    console.log("PROCESS METADATA", metadata)
}

async function setProcessStatus() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const processMetadata: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
    const processParams = {
        mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
        envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES | ProcessEnvelopeType.SERIAL, // bit mask
        censusOrigin: ProcessCensusOrigin.OFF_CHAIN,
        metadata: processMetadata,
        censusMerkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
        censusMerkleTree: "ipfs://1234123412341234",
        startBlock: 500,
        blockCount: 1000,
        maxCount: 1,
        maxValue: 3,
        maxTotalCost: 0,
        uniqueValues: false,
        costExponent: 10000,
        maxVoteOverwrites: 1,
        namespace: 0,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    const processId = await VotingApi.newProcess(processParams, wallet, pool)
    console.log("Created", processId)

    // Get process parameters on the contract
    let params = await VotingApi.getProcessParameters(processId, pool)
    console.log("Prior status:", params.status, "Ended:", params.status.isEnded)

    // Set new status
    await VotingApi.setStatus(processId, ProcessStatus.ENDED, wallet, pool)
    params = await VotingApi.getProcessParameters(processId, pool)
    console.log("Current status:", params.status, "Ended:", params.status.isEnded)
}

async function showProcessResults() {
    // const wallet = WalletUtil.fromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()

    console.log("Entity Addr", myEntityAddress)
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const processId = "0xc69acd6435f622f5dda70e887cbebe3994b67d68686ca31872cb9b4a64525374"

    console.log("getRawRawResults", await VotingApi.getRawResults(processId, pool))
    console.log("getResultsDigest", JSON.stringify(await VotingApi.getResultsDigest(processId, pool), null, 2))
}

async function cloneVotingProcess() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    console.log("Updating...")
    const PROCESS_ID_CURRENT = "0xe0b52bee5470b195b7633d007b587fbfa74653c8cac31ba260ddbc22b7d1d6eb"
    const currentMetadata = await VotingApi.getProcessMetadata(PROCESS_ID_CURRENT, pool)
    const currentParameters = await VotingApi.getProcessParameters(PROCESS_ID_CURRENT, pool)
    const currentBlock = await VotingApi.getBlockHeight(pool)
    const startBlock = currentBlock + 100
    const blockCount = 2000

    const NEW_MERKLE_ROOT = "0xbae0912183e55c3173bad6eeb4408bfe4de6892f82123562475aca66b109ba13"
    const NEW_MERKLE_TREE_ORIGIN = "ipfs://QmUC4NokWrykhZwY9CNGPz7KS8AvHWD3M4SLk5doMRMCmA"

    const params = {
        mode: currentParameters.mode,
        envelopeType: currentParameters.envelopeType,
        censusOrigin: currentParameters.censusOrigin,
        metadata: currentMetadata,
        startBlock,
        blockCount,
        censusMerkleRoot: NEW_MERKLE_ROOT,
        censusMerkleTree: NEW_MERKLE_TREE_ORIGIN,
        maxCount: currentParameters.maxCount,
        questionCount: currentParameters.questionCount,
        costExponent: currentParameters.costExponent,
        namespace: currentParameters.namespace,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000",
        maxValue: currentParameters.maxCount,
        maxTotalCost: currentParameters.maxTotalCost,
        maxVoteOverwrites: currentParameters.maxVoteOverwrites
    }
    const processId = await VotingApi.newProcess(params, wallet, pool)

    delete currentParameters.entityAddress // these are overwritten later on
    delete currentParameters.questionCount

    const newProcessId = await VotingApi.newProcess(params, wallet, pool)

    console.log("CREATED", newProcessId)

    // READING BACK:
    const metadata = await VotingApi.getProcessMetadata(newProcessId, pool)
    console.log("PROCESS METADATA", metadata)
}

async function useVoteApi() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const myEntityAddress = await wallet.getAddress()

    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    const entityMeta = await EntityApi.getMetadata(myEntityAddress, pool)
    console.log("- Active processes:", entityMeta.votingProcesses.active)

    const processId = entityMeta.votingProcesses.active[entityMeta.votingProcesses.active.length - 1]
    // const processId = "0xf36b729d6226b8257922a60cea6ab80e47686c3f86edbd0749b1c3291e2651ed"
    // const processId = "0x55b6f0b5180c918d8e815e5a6e7b093caf3c496bd104a177d90bd81bfe1bd312"
    const processParams = await VotingApi.getProcessParameters(processId, pool)
    // const processMeta = await VotingApi.getProcessMetadata(processId, pool)

    const censusMerkleRoot = processParams.censusMerkleRoot

    console.log("Reading", processId)

    console.log("BLOCKCHAIN INFO:\n")
    console.log("- Process startBlock:", processParams.startBlock)
    console.log("- Process endBlock:", processParams.startBlock + processParams.blockCount)
    console.log("- Census size:", await CensusApi.getCensusSize(censusMerkleRoot, pool))
    console.log("- Block height:", await VotingApi.getBlockHeight(pool))
    console.log("- Envelope height:", await VotingApi.getEnvelopeHeight(processId, pool))

    const startDate = await VotingApi.estimateDateAtBlock(processParams.startBlock, pool)
    console.log("- Start date:", startDate < new Date() ? "[already started]" : startDate)

    const endDate = await VotingApi.estimateDateAtBlock(processParams.startBlock + processParams.blockCount, pool)
    console.log("- End date:", endDate < new Date() ? "[already ended]" : endDate)

    console.log("- Date at block 500:", await VotingApi.estimateDateAtBlock(500, pool))
    console.log("- Block in 200 seconds:", await VotingApi.estimateBlockAtDateTime(new Date(Date.now() + VOCHAIN_BLOCK_TIME * 20), pool))

    const publicKeyHash = CensusApi.digestHexClaim(wallet["_signingKey"]().publicKey)
    const merkleProof = await CensusApi.generateProof(censusMerkleRoot, publicKeyHash, true, pool)
    const votes = [1, 2, 1]

    // Open vote version:
    const voteEnvelope = await VotingApi.packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet })

    // Encrypted vote version:
    // const voteEnvelope = await VotingApi.packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet, encryptionPubKeys: ["6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"] })

    console.log("- Poll Envelope:", voteEnvelope)

    console.log("- Submitting vote envelope")
    await VotingApi.submitEnvelope(voteEnvelope, pool)

    const envelopeList = await VotingApi.getEnvelopeList(processId, 0, 100, pool)
    console.log("- Envelope list:", envelopeList)
    if (envelopeList.length > 0)
        console.log("- Retrieved Vote:", await VotingApi.getEnvelope(processId, pool, envelopeList[envelopeList.length - 1]))

    console.log("getRawRawResults", await VotingApi.getRawResults(processId, pool))
    console.log("getResultsDigest", JSON.stringify(await VotingApi.getResultsDigest(processId, pool), null, 2))
}

async function submitVoteBatch() {
    const fromAccountIdx = 6
    const toAccountIdx = 9

    // const entityEnsNode = "0x180dd5765d9f7ecef810b565a2e5bd14a3ccd536c442b3de74867df552855e85"
    // const entityMeta = await EntityApi.getMetadata(myEntityAddress, gw)
    // const processId = entityMeta.votingProcesses.active[entityMeta.votingProcesses.active.length - 1]

    const processId = "0xfbfdb1795eadc8fb8b0249e8a597ab7cc4a6a2a5f3a87db454eadda818cba014"

    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.init()

    const processParams = await VotingApi.getProcessParameters(processId, pool)
    const processMeta = await VotingApi.getProcessMetadata(processId, pool)
    const censusMerkleRoot = processParams.censusMerkleRoot

    console.log("On Process", processId)

    // Load a set of registered accounts that can vote on the process
    if (!require('fs').existsSync(__dirname + "/user-accounts.json")) throw new Error("File user-accounts.json does not exist")
    var censusAccounts = require(__dirname + "/user-accounts.json")
    if (!Array.isArray(censusAccounts)) throw new Error("File user-accounts.json does not contain a valid array")
    else if (toAccountIdx >= censusAccounts.length) throw new Error("'toAccountIdx' is greater than the size of the user accounts array")

    for (let idx = fromAccountIdx; idx < toAccountIdx; idx++) {
        try {
            const { mnemonic, publicKey, address } = censusAccounts[idx]
            console.log("Using account", idx, publicKey)

            const wallet = Wallet.fromMnemonic(mnemonic, PATH)
            // const myEntityAddress = await wallet.getAddress()

            const publicKeyHash = CensusApi.digestHexClaim(wallet["_signingKey"]().publicKey)
            const merkleProof = await CensusApi.generateProof(censusMerkleRoot, publicKeyHash, true, pool)
            const votes = [1]
            const voteEnvelope = await VotingApi.packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet })
            // Encrypted version:
            // const voteEnvelope = await VotingApi.packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet, encryptionPubKeys: ["6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"] })

            console.log("- Submitting vote envelope")
            await VotingApi.submitEnvelope(voteEnvelope, pool)

            console.log("- Envelope height is now:", await VotingApi.getEnvelopeHeight(processId, pool))
        } catch (err) {
            console.error("- Failed:", err)
        }
    }
}

async function checkSignature() {
    //const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = Wallet.fromMnemonic("poverty castle step need baby chair measure leader dress print cruise baby avoid fee sock shoulder rate opinion", PATH)
    // const expectedPublicKey = "0x04d811f8ade566618a667715c637a7f3019f46ae0ffc8b2ec3b16b1f72999e2e2f9e9b50c78ca34175d78942de88798cce5d53569f96579a95ec9bab17c0131d4f"
    // const expectedAddress = "0xe3A0ba4B2Ec804869d9D78857C5c4c6aA493aD00"
    // const body = { "method": "getVisibility", "timestamp": Date.now()}
    //const message = JSON.stringify(body)
    //const signature = await JsonSignature.sign(body, wallet)

    const expectedAddress = await wallet.getAddress()
    const expectedPublicKey = wallet["_signingKey"]().publicKey

    let body = { "actionKey": "register", "dateOfBirth": "1975-01-25T12:00:00.000Z", "email": "john@me.com", "entityId": "0xf6515536038e12212adc96395021ad1f1f089a239f0ba4c139d364ededd00c54", "firstName": "John", "lastName": "Mayer", "method": "register", "phone": "5555555", "timestamp": 1582821257721 }
    let givenSignature = "0x3086bf3de0d22d2d51f274d4618ea963b60b1e590f5ef0b1a2df17447746d4503f595e87330fb9cc9387c321acc9e476baedfd0681d864f68f4f1bc84548725c1b"

    // let body = { "actionKey": "register", "dateOfBirth": "1975-01-23T12:00:00.000Z", "email": "ferran@me.com", "entityId": "0xf6515536038e12212adc96395021ad1f1f089a239f0ba4c139d364ededd00c54", "firstName": "Ferran", "lastName": "Adrià", "method": "register", "phone": "5555555555", "timestamp": 1582820811597 }
    // let givenSignature = "0x12d77e67c734022f7ab66231377621b75b454d724303bb158019549cf9f02d384d9af1d33266ca017248d8914b111cbb68b7cc9f045e95ccbde5ce389254450f1b"

    const message = JSON.stringify(body)

    const computedSignature = await JsonSignature.sign(body, wallet)

    console.log("Issuing signature\n")
    console.log("- ADDR:        ", expectedAddress)
    console.log("- PUB K:       ", expectedPublicKey)
    console.log("- SIG (given)  ", givenSignature)
    console.log("- SIG (comp)   ", computedSignature)
    console.log()

    // Approach 1
    const isValid = JsonSignature.isValid(givenSignature, expectedPublicKey, body)
    const actualPubKey = JsonSignature.recoverPublicKey(body, givenSignature)

    console.log("Approach 1")
    console.log("- Expected PUB K:   ", expectedPublicKey)
    console.log("- Actual PUB K:     ", actualPubKey)
    console.log("- Signature valid:  ", isValid)
    console.log()

    // Approach 2
    const actualAddress = utils.verifyMessage(utils.toUtf8Bytes(message), givenSignature)

    console.log("Approach 2")
    console.log("- Expected addr:    ", expectedAddress)
    console.log("- Actual addr:      ", actualAddress)
    console.log()

    // Approach 3

    const msgBytes = utils.toUtf8Bytes(message);
    const msgHash = utils.hashMessage(msgBytes);
    const msgHashBytes = utils.arrayify(msgHash);

    // Now you have the digest,
    const recoveredPubKey = utils.recoverPublicKey(msgHashBytes, givenSignature);
    const recoveredAddress = utils.recoverAddress(msgHashBytes, givenSignature);

    const signaturesMatch = expectedPublicKey === recoveredPubKey

    console.log("Approach 3")
    console.log("- Expected addr:    ", expectedAddress)
    console.log("- Recovered addr:   ", recoveredAddress)

    console.log("- Expected PUB K:   ", expectedPublicKey)
    console.log("- Recovered PUB K:  ", recoveredPubKey)

    console.log("- SIGNATURE:        ", computedSignature)
    console.log("- Signature OK?     ", signaturesMatch)
    console.log()
}

async function fetchMerkleProof() {
    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.init()

    console.log("FETCHING CLAIM", process.env.BASE64_CLAIM_DATA)
    console.log("on Merkle Tree", process.env.CENSUS_MERKLE_ROOT)

    const siblings = await CensusApi.generateProof(process.env.CENSUS_MERKLE_ROOT, process.env.BASE64_CLAIM_DATA, true, pool)
    console.log("SIBLINGS:", siblings)
}

async function gatewayHealthCheck() {
    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const entityEnsNode = ensHashAddress(myEntityAddress)

    const bootNodeData = await GatewayBootnode.getDefaultGateways(NETWORK_ID)
    const gws = GatewayBootnode.digest(bootNodeData)

    const URL = "https://hnrss.org/newest"
    const response = await axios.get(URL)

    for (let networkId in gws) {
        for (let gw of gws[networkId].dvote) {
            console.log("Checking", gw.uri)

            await gw.init()
            const origin = await FileApi.add(response.data, "hn-rss.xml", wallet, gw)
            console.log("STORED ON", origin, "USING", gw.uri)
        }

        for (let gw of gws[networkId].web3) {
            console.log("Checking Web3 GW...")

            const instance = await gw.getEnsPublicResolverInstance(wallet)
            const tx = await instance.setText(entityEnsNode, "dummy", "1234")
            await tx.wait()
        }
    }
}

async function gatewayRawRequest() {
    // const BOOTNODES_URL = " ... "
    // const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL_RW })
    await pool.init()

    console.log("THE DVOTE GW:", pool.activeGateway.publicKey)

    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const req = { method: "getGatewayInfo" as DVoteGatewayMethod }  // Low level raw request
    const timeout = 5 * 1000
    const r = await pool.sendRequest(req, wallet, { timeout })
    console.log("RESPONSE:", r)

    // UNSIGNED
    const origin = "ipfs://12341234..."
    console.log("\nReading from", GATEWAY_DVOTE_URI)
    console.log("\nReading", origin)
    const data = await FileApi.fetchString(origin, pool)
    console.log("DATA:", data)
}

async function ensResolver() {
    // const provider = new providers.EtherscanProvider()
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)

    const resolverAddr = await provider.resolveName("entities.vocdoni.eth")
    const processesAddr = await provider.resolveName("processes.vocdoni.eth")
    const namespacesAddr = await provider.resolveName("namespaces.vocdoni.eth")
    const storageProofsAddr = await provider.resolveName("erc20.proofs.vocdoni.eth")

    console.log("Entity Resolver contract address", resolverAddr)
    console.log("Processes contract address", processesAddr)
    console.log("Namespaces contract address", namespacesAddr)
    console.log("Storage proofs contract address", storageProofsAddr)
}

async function testGatewayInitialization() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const ETH_NETWORK_ID = NETWORK_ID
    let pool: GatewayPool, gateway: Gateway
    let options: IGatewayDiscoveryParameters = {
        networkId: ETH_NETWORK_ID,
        bootnodesContentUri: BOOTNODES_URL_RO,
        numberOfGateways: 2,
        timeout: 5 * 1000,
    }

    console.log("==============================")
    console.time("Pool")
    pool = await GatewayPool.discover(options)
    await pool.init()
    console.log("Connected to", await pool.dvoteUri)
    console.log("Connected to", pool.web3Uri)

    // Default Gateway
    console.log("==============================")
    console.time("Random Gateway from default Bootnode")
    gateway = await Gateway.randomFromDefault(ETH_NETWORK_ID)
    console.timeEnd("Random Gateway from default Bootnode")

    await gateway.init()
    console.log("Connected to", gateway.dvoteUri)
    console.log("Connected to", gateway.provider["connection"].url)

    // Gateway from URI
    console.log("==============================")
    console.time("Random Gateway from URI")
    gateway = await Gateway.randomfromUri(ETH_NETWORK_ID, BOOTNODES_URL_RO)
    console.timeEnd("Random Gateway from URI")

    await gateway.init()
    console.log("Connected to", gateway.dvoteUri)
    console.log("Connected to", gateway.provider["connection"].url)

    // Gateway from info
    console.log("==============================")
    console.time("Gateway from gatewayInfo")
    const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
    gateway = await Gateway.fromInfo(gwInfo)
    console.timeEnd("Gateway from gatewayInfo")

    await gateway.init()
    console.log("Connected to", gateway.dvoteUri)
    console.log("Connected to", gateway.provider["connection"].url)

    return
}

async function main() {
    // Ethereum

    // await attachToEntityResolver()
    // await attachToVotingProcess()

    // Vocdoni API's

    // await checkGatewayStatus()
    // await fileDownload("ipfs://QmXLgWLYfa826DSCawfb1R34XBQYzs1z4xiLoChu7hUZyM")
    // await emptyFeedUpload()
    // await fileUpload()
    // await registerEntity()
    // await readEntity()
    // await updateEntityInfo()
    // await createProcessRaw()
    // await createProcessFull()
    // await censusMethods()
    // await showProcessResults()
    // await setProcessStatus()
    // await cloneVotingProcess()
    await useVoteApi()
    // await submitVoteBatch()
    // await fetchMerkleProof()
    // await checkSignature()
    // await gatewayRawRequest()
    // await testGatewayInitialization()

    // await gatewayHealthCheck()
    // await ensResolver()
    // await workingGatewayInfo()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
