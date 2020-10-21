console.log("Reading .env (if present)...")
require('dotenv').config({ path: __dirname + "/.env" })

import axios from "axios"
import * as fs from "fs"
import { utils, providers, Wallet } from "ethers"
import { walletFromSeededPassphrase, generateRandomHexSeed } from "../src/util/signers"
import { getEntityId, updateEntity, getEntityMetadata, getEntityMetadataByAddress } from "../src/api/entity"
import { newProcess, getProcessMetadata, estimateBlockAtDateTime, isCanceled, cancelProcess, getRawResults, getResultsDigest, getBlockHeight, getEnvelopeHeight, estimateDateAtBlock, packageSignedEnvelope, submitEnvelope, getEnvelopeList, getEnvelope, setStatus } from "../src/api/vote"
import { DVoteGateway, Web3Gateway, Gateway } from "../src/net/gateway"
import { GatewayPool } from "../src/net/gateway-pool"
import { addCensus, addClaim, addClaimBulk, getRoot, publishCensus, dump, dumpPlain, getCensusSize, digestHexClaim, generateProof } from "../src/api/census"
import { fetchDefaultBootNode, getGatewaysFromBootNodeData } from "../src/net/gateway-bootnodes"
import { EntityMetadataTemplate, EntityMetadata, TextRecordKeys } from "../src/models/entity"
import { ProcessMetadata, ProcessMetadataTemplate } from "../src/models/process"
import { deployEntityResolverContract, getEntityResolverInstance, deployProcessContract, getProcessInstance } from "../src/net/contracts"
import { addFile, fetchFileString } from "../src/api/file"
import GatewayInfo from "../src/wrappers/gateway-info"
import ContentHashedURI from "../src/wrappers/content-hashed-uri"
import { VOCHAIN_BLOCK_TIME } from "../src/constants"
import { signJsonBody, isSignatureValid, recoverSignerPublicKey } from "../src/util/json-sign"
import { WsGatewayMethod } from "../src/models/gateway"
import { GatewayDiscoveryParameters } from "../src/net/gateway-discovery"
import { ProcessStatus } from "dvote-solidity"

const MNEMONIC = process.env.MNEMONIC || "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_PUB_KEY = process.env.GATEWAY_PUB_KEY || "02325f284f50fa52d53579c7873a480b351cc20f7780fa556929f5017283ad2449"
const GATEWAY_DVOTE_URI = process.env.GATEWAY_DVOTE_URI || "wss://myhost/dvote"
const GATEWAY_WEB3_URI = process.env.GATEWAY_WEB3_URI || "https://sokol.poa.network"

const NETWORK_ID = "sokol"
const WALLET_SEED = process.env.WALLET_SEED
const WALLET_PASSPHRASE = process.env.WALLET_PASSPHRASE

async function deployEntityResolver() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Deploying Entity Resolver contract...")
    const contractInstance = await deployEntityResolverContract({ provider, wallet })
    await contractInstance.deployTransaction.wait()
    console.log("Entity Resolver deployed at", contractInstance.address)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Address:", myEntityAddress)
    console.log("Entity ID:", myEntityId)

    console.log("Setting 'my-key' = '1234'")
    const tx = await contractInstance.setText(myEntityId, "my-key", "1234")
    await tx.wait()

    console.log("Value set")
    const val = await contractInstance.text(myEntityId, "my-key")
    console.log("Value stored on the blockchain:", val)
}

async function attachToEntityResolver() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Attaching to contract...")
    const contractInstance = await getEntityResolverInstance({ provider, wallet })

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Address:", myEntityAddress)
    console.log("Entity ID:", myEntityId)

    const tx = await contractInstance.setText(myEntityId, TextRecordKeys.VOCDONI_BOOT_NODES, "https://bootnodes.vocdoni.net/gateways.json")
    await tx.wait()
    console.log("Reading 'vnd.vocdoni.boot-nodes'")
    const val = await contractInstance.text(myEntityId, TextRecordKeys.VOCDONI_BOOT_NODES)
    console.log("Value stored on the blockchain:", val)
}

async function deployVotingProcess() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    // Set your values here
    const PREDECESSOR_ADDRESS = "0x0000000000000000000000000000000000000000"
    const NAMESPACE_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"

    console.log("Deploying Voting Process contract...")
    const contractInstance = await deployProcessContract({ provider, wallet }, [PREDECESSOR_ADDRESS, NAMESPACE_CONTRACT_ADDRESS])
    await contractInstance.deployTransaction.wait()
    console.log("Voting Process deployed at", contractInstance.address)

    console.log("Setting genesis")
    const tx = await contractInstance.setGenesis("ipfs://ipfs-hash-here!sha3-hash-here")
    await tx.wait()

    console.log("Deployment completed!")
}

async function attachToVotingProcess() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Attaching to contract at from")
    const contractInstance = await getProcessInstance({ provider, wallet })

    console.log("Reading 'genesis'")
    let val = await contractInstance.getGenesis()
    console.log("Value stored on the blockchain:", val)

    console.log("Setting genesis")
    const tx = await contractInstance.setGenesis("ipfs://ipfs-hash-2-here!sha3-hash-here")
    await tx.wait()

    console.log("Reading 'genesis'")
    val = await contractInstance.getGenesis()
    console.log("Value stored on the blockchain:", val)
}

async function checkGatewayStatus() {
    let gw: Gateway
    try {
        gw = await Gateway.randomFromDefault(NETWORK_ID)

        const status = await gw.getGatewayInfo()
        console.log("Gateway status", status)
        gw.disconnect()
    }
    catch (err) {
        if (gw) gw.disconnect()
        console.error("The gateway can't be reached", err)
    }
}

async function fileUpload() {
    var dvoteGw
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

        dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file"], publicKey: GATEWAY_PUB_KEY })
        await dvoteGw.connect()

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        console.error("PUTTING STRING OF LENGTH: ", strData.length)
        const origin = await addFile(Buffer.from(strData), "mobile-org-web-action-example.html", wallet, dvoteGw)
        console.log("DATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await fetchFileString(origin, dvoteGw)
        console.log("DATA:", data)

        dvoteGw.disconnect()
    } catch (err) {
        if (dvoteGw) dvoteGw.disconnect()
        console.error(err)
    }
}

async function fileDownload(address) {
    let gw: Gateway
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
        gw = await Gateway.randomFromDefault(NETWORK_ID)

        console.log("SIGNING FROM ADDRESS", wallet.address)
        const data = await fetchFileString(address, gw)
        console.log("DATA:", JSON.stringify(JSON.parse(data), null, 2))

        gw.disconnect()
    } catch (err) {
        if (gw) gw.disconnect()
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
    var gw: Gateway
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
        gw = await Gateway.randomFromDefault(NETWORK_ID)

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = JSON.stringify(feed)
        console.error("PUTTING STRING OF LENGTH: ", strData.length)
        const origin = await addFile(Buffer.from(strData), "feed-template.json", wallet, gw)
        console.log("DATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await fetchFileString(origin, gw)
        console.log("DATA:", data)

        gw.disconnect()
    } catch (err) {
        if (gw) gw.disconnect()
        console.error(err)
    }
}

async function registerEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)
    // const pool = await GatewayPool.discover({ networkId: "goerli" })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "http://bootnodes.vocdoni.net/gateways.dev.json" })
    await pool.connect()

    // const entityMetadata: EntityMetadata = JSON.parse(JSON.stringify(EntityMetadataTemplate))
    // entityMetadata.name.default = "Test Entity"
    // entityMetadata.actions[0].url = "wss://registry.vocdoni.net/api/registry"
    // entityMetadata.actions[0].visible = "wss://registry.vocdoni.net/api/registry"

    const entityMetadata: EntityMetadata = { version: '1.0', languages: ['default'], name: { default: 'Vilafourier18' }, description: { default: 'Official communication and participation channel administered by the city council' }, votingProcesses: { active: ['0x254f0f1789e05de5574eb305fc39d1adbadef83ef0fa2cbed30fb9f18dc9247f'], ended: ['0x711b6a0f5f50211efa3fbc3f4456ffd2b0ec274e638434579dae7d903fdbe1dd'] }, newsFeed: { default: 'ipfs://QmRg675gU924YM5eKQ72Dfe1aYkZsdriT4fnHbAbTtoBvq' }, media: { avatar: 'https://ipfs.io/ipfs/QmWm23t4FdCYdEpTmYYWdjPZFepCvk9GJTSSMdv8xU3Hm9', header: 'https://ipfs.io/ipfs/Qmb4tMak41v6WigrFqovo6AATy23pNZGFCa9PHJDjg6kWz' }, actions: [{ type: 'register', actionKey: 'register', name: { default: "Sign up" }, url: 'wss://registry.vocdoni.net/api/registry', visible: 'wss://registry.vocdoni.net/api/registry' }], bootEntities: [], fallbackBootNodeEntities: [], trustedEntities: [], censusServiceManagedEntities: [] }
    const contentUri = await updateEntity(myEntityAddress, entityMetadata, wallet, pool)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)

    pool.disconnect()
}

async function readEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)
    // const pool = await GatewayPool.discover({ networkId: "goerli", bootnodesContentUri: "https://bootnodes.vocdoni.net/gateways.json" })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "https://bootnodes.vocdoni.net/gateways.json" })
    await pool.connect()

    const meta = await getEntityMetadata(myEntityId, pool)
    console.log("JSON METADATA\n", meta)

    pool.disconnect()
}

async function updateEntityInfo() {
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "https://bootnodes.vocdoni.net/gateways.dev.json" })
    await pool.connect()

    console.log("UPDATING ENTITY ID:", getEntityId(myEntityAddress))
    const meta = await getEntityMetadataByAddress(myEntityAddress, pool)

    // meta.votingProcesses.active = []  // Unlist voting processes
    // meta.votingProcesses.ended = []  // Unlist voting processes
    // meta.actions[0].url = "wss://my-server/endpoint"
    // meta.actions[0].visible = "wss://my-server/endpoint"
    await updateEntity(myEntityAddress, meta, wallet, pool)
    console.log("updated")

    pool.disconnect()
}

async function gwCensusOperations() {
    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file", "census"], publicKey: GATEWAY_PUB_KEY })
    const gw = new Gateway(dvoteGw, null)
    await gw.connect()

    const censusName = "My census name " + Math.random().toString().substr(2)
    const adminPublicKeys = [await wallet["signingKey"].publicKey]
    const publicKeyClaims = [
        "0412d6dc30db7d2a32dddd0ba080d244cc26fcddcc29beb3fcb369564b468b9927445ab996fecbdd6603f6accbc4b3f773a9fe59b66f6e8ef6d9ecf70d8cee5a73",
        "043980b22e9432aa2884772570c47a6f78a39bcc08b428161a503eeb91f66b1901ece9b82d2624ed5b44fa02922c28080c717f474eca16c54aecd74aba3eb76953",
        "04f64bd4dc997f1eed4f20843730c13d926199ff45a9edfad191feff0cea6e3d54de43867463acdeeaae990ee6882138b79ee33e3ae7e4f2c12dc0a52088bbb620",
        "04b9bd5b6f90833586cfcd181d1abe66d14152bb100ed7ec63ff94ecfe48dab18757177cac4551bc56bcf586d056d0f3709443face6b6bac7c55316e54522b4d2b"
    ]
    publicKeyClaims[publicKeyClaims.length - 1] = "wrong_value"
    console.log(publicKeyClaims);

    // Create a census if it doesn't exist
    let result1 = await addCensus(censusName, adminPublicKeys, gw, wallet)
    console.log(`ADD CENSUS "${censusName}" RESULT:`, result1)

    // Add a claim to the new census
    const censusId = result1.censusId
    let result2 = await addClaim(censusId, publicKeyClaims[0], false, gw, wallet)
    console.log("ADDED", publicKeyClaims[0], "TO", censusId)

    // Add claims to the new census
    let result3 = await addClaimBulk(censusId, publicKeyClaims.slice(1), false, gw, wallet)
    console.log("ADDED", publicKeyClaims.slice(1), "TO", censusId)
    if (result3.invalidClaims.length > 0) console.log("INVALID CLAIMS", result3.invalidClaims)
    const merkleRoot = await getRoot(censusId, gw)
    console.log("MERKLE ROOT", merkleRoot)  // 0x....

    const merkleTree = await publishCensus(censusId, gw, wallet)
    console.log("PUBLISHED", censusId)
    console.log(merkleTree)   // ipfs://....

    let result4 = await dump(censusId, gw, wallet)
    console.log("DUMP", result4)

    let result5 = await dumpPlain(censusId, gw, wallet)
    console.log("DUMP PLAIN", result5)

    gw.disconnect()
}

async function createVotingProcessManual() {
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)
    // const pool = await GatewayPool.discover({ networkId: "goerli" })
    const gw = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "http://bootnodes.vocdoni.net/gateways.dev.json" })
    await gw.connect()

    console.log("Attaching to contract")
    const contractInstance = await gw.getProcessInstance(wallet)

    console.log("Uploading metadata...")
    const processMetadata = Object.assign({}, ProcessMetadataTemplate, { startBlock: 20000 })
    const strData = JSON.stringify(processMetadata)
    const origin = await addFile(Buffer.from(strData), "process-metadata.json", wallet, gw)
    console.log("process-metadata.json\nDATA STORED ON:", origin)

    const metaCuri = new ContentHashedURI(`ipfs://${origin}`)
    metaCuri.setHashFrom(strData)

    const censusCuri = new ContentHashedURI("http://localhost/")
    censusCuri.setHashFrom("")

    console.log("Creating process with parameters:", metaCuri.toString(), "0x0", censusCuri.toString())
    const tx = await contractInstance.newProcess("poll-vote", metaCuri.toString(), "0x0", censusCuri.toString(), 500, 100)
    const result = await tx.wait()
    console.log("RESULT", result)

    gw.disconnect()
}

async function createVotingProcessFull() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)
    // const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
    // const web3Gateway = new Web3Gateway(gwInfo)
    // const dvoteGateway = new DVoteGateway(gwInfo)
    // await dvoteGateway.connect()

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)
    // const pool = await GatewayPool.discover({ networkId: "goerli" })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: "https://bootnodes.vocdoni.net/gateways.dev.json" })
    await pool.connect()

    // const entityMetaPre = await getEntityMetadata(myEntityId, pool)

    const processMetadata: ProcessMetadata = {
        "version": "1.0",
        "startBlock": 0,
        "blockCount": 200000,
        "census": {
            "merkleRoot": "0x1234",
            "merkleTree": "ipfs://2345"
        },
        "details": {
            "entityId": "",
            "title": { "default": "Board election" },
            "description": {
                "default": ""
            },
            "headerImage": "https://ipfs.io/ipfs/1234...",
            "streamUrl": "",
            "questions": [
                {
                    "type": "single-choice",
                    "question": { "default": "CEO" },
                    "description": { "default": "Chief Executive Officer" },
                    "voteOptions": [
                        { "title": { "default": "Yellow list" }, "value": 0 },
                        { "title": { "default": "Pink list" }, "value": 1 },
                        { "title": { "default": "Abstention" }, "value": 2 },
                        { "title": { "default": "White vote" }, "value": 3 }
                    ]
                },
                {
                    "type": "single-choice",
                    "question": { "default": "CFO" },
                    "description": { "default": "Chief Financial Officer" },
                    "voteOptions": [
                        { "title": { "default": "Yellow list" }, "value": 0 },
                        { "title": { "default": "Pink list" }, "value": 1 },
                        { "title": { "default": "Abstention" }, "value": 2 },
                        { "title": { "default": "White vote" }, "value": 3 }
                    ]
                },
            ]
        }
    }
    processMetadata.details.entityId = myEntityId
    processMetadata.startBlock = await estimateBlockAtDateTime(new Date(Date.now() + 1000 * 60 * 5), pool)
    processMetadata.blockCount = 6 * 60 * 24 // 1 day

    const processId = await newProcess(processMetadata, wallet, pool)
    const entityMetaPost = await getEntityMetadataByAddress(myEntityAddress, pool)

    console.log("CREATED", processId)
    // console.log("METADATA BEFORE:", entityMetaPre.votingProcesses.active)
    // console.log("METADATA AFTER:", entityMetaPost.votingProcesses.active)

    // READING BACK:
    const metadata = await getProcessMetadata(processId, pool)
    console.log("PROCESS METADATA", metadata)

    pool.disconnect()
}

async function cancelVotingProcess() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)

    const pool = await GatewayPool.discover({ networkId: NETWORK_ID })
    await pool.connect()

    const processId = await newProcess(ProcessMetadataTemplate, wallet, pool)
    const canceledPre = await isCanceled(processId, pool)
    await setStatus(processId, ProcessStatus.CANCELED, wallet, pool)
    const canceledPost = await isCanceled(processId, pool)

    console.log("Created", processId)
    console.log("Canceled (before)", canceledPre)
    console.log("Canceled (after)", canceledPost)

    pool.disconnect()
}

async function showProcessResults() {
    const wallet = walletFromSeededPassphrase(WALLET_PASSPHRASE, WALLET_SEED)
    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Addr", myEntityAddress)
    console.log("Entity ID", myEntityId)
    // const pool = await GatewayPool.discover({ networkId: "goerli" })
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID })
    await pool.connect()

    const processId = "0xc69acd6435f622f5dda70e887cbebe3994b67d68686ca31872cb9b4a64525374"

    console.log("getRawRawResults", await getRawResults(processId, pool))
    console.log("getResultsDigest", JSON.stringify(await getResultsDigest(processId, pool), null, 2))
}

async function cloneVotingProcess() {
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.connect()

    console.log("Updating...")
    const PROCESS_ID_OLD = "0x6529717ebd0926f9096d6ae342c67bfd7dce90ce8eb2dbf9342a51d70fffb759"
    const processMetadata = await getProcessMetadata(PROCESS_ID_OLD, pool)
    const currentBlock = 765
    const startBlock = currentBlock + 130
    processMetadata.startBlock = startBlock
    processMetadata.blockCount = 60480
    const NEW_MERKLE_ROOT = "0xbae0912183e55c3173bad6eeb4408bfe4de6892f82123562475aca66b109ba13"
    const NEW_MERKLE_TREE_ORIGIN = "ipfs://QmUC4NokWrykhZwY9CNGPz7KS8AvHWD3M4SLk5doMRMCmA"
    processMetadata.census.merkleRoot = NEW_MERKLE_ROOT
    processMetadata.census.merkleTree = NEW_MERKLE_TREE_ORIGIN

    const processId = await newProcess(processMetadata, wallet, pool)

    console.log("CREATED", processId)

    // READING BACK:
    const metadata = await getProcessMetadata(processId, pool)
    console.log("PROCESS METADATA", metadata)

    pool.disconnect()
}

async function useVoteApi() {
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const myEntityAddress = await wallet.getAddress()

    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.connect()

    const entityMeta = await getEntityMetadataByAddress(myEntityAddress, pool)
    console.log("- Active processes:", entityMeta.votingProcesses.active)
    const processId = entityMeta.votingProcesses.active[entityMeta.votingProcesses.active.length - 1]
    // const processId = "0xf36b729d6226b8257922a60cea6ab80e47686c3f86edbd0749b1c3291e2651ed"
    // const processId = "0x04eff29970a18ff5e46ff9b1eae5b320ee782ecadaaef341e842cb97ef310477"
    const processMeta = await getProcessMetadata(processId, pool)

    // const censusMerkleRoot = process.env.CENSUS_MERKLE_ROOT // TODO: use the one below
    const censusMerkleRoot = processMeta.census.merkleRoot

    console.log("Reading", processId)

    console.log("BLOCKCHAIN INFO:\n")
    console.log("- Process startBlock:", processMeta.startBlock)
    console.log("- Process endBlock:", processMeta.startBlock + processMeta.blockCount)
    console.log("- Census size:", await getCensusSize(censusMerkleRoot, pool))
    console.log("- Block height:", await getBlockHeight(pool))
    console.log("- Envelope height:", await getEnvelopeHeight(processId, pool))

    const startDate = await estimateDateAtBlock(processMeta.startBlock, pool)
    console.log("- Start date:", startDate < new Date() ? "[already started]" : startDate)

    const endDate = await estimateDateAtBlock(processMeta.startBlock + processMeta.blockCount, pool)
    console.log("- End date:", endDate < new Date() ? "[already ended]" : endDate)

    console.log("- Date at block 500:", await estimateDateAtBlock(500, pool))
    console.log("- Block in 200 seconds:", await estimateBlockAtDateTime(new Date(Date.now() + VOCHAIN_BLOCK_TIME * 20), pool))

    const publicKeyHash = digestHexClaim(wallet["signingKey"].publicKey)
    const merkleProof = await generateProof(censusMerkleRoot, publicKeyHash, true, pool)
    const votes = [1, 2, 1]

    // Open vote version:
    const voteEnvelope = await packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet })

    // Encrypted vote version:
    // const voteEnvelope = await packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet, encryptionPubKeys: ["6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"] })

    console.log("- Poll Envelope:", voteEnvelope)

    console.log("- Submitting vote envelope")
    await submitEnvelope(voteEnvelope, pool)

    const envelopeList = await getEnvelopeList(processId, 0, 100, pool)
    console.log("- Envelope list:", envelopeList);
    if (envelopeList.length > 0)
        console.log("- Retrieved Vote:", await getEnvelope(processId, pool, envelopeList[envelopeList.length - 1]))

    console.log("getRawRawResults", await getRawResults(processId, pool))
    console.log("getResultsDigest", JSON.stringify(await getResultsDigest(processId, pool), null, 2))
    pool.disconnect()
}

async function submitVoteBatch() {
    const fromAccountIdx = 6
    const toAccountIdx = 9

    // const myEntityId = "0x180dd5765d9f7ecef810b565a2e5bd14a3ccd536c442b3de74867df552855e85"
    // const entityMeta = await getEntityMetadata(myEntityAddress, gwInfo)
    // const processId = entityMeta.votingProcesses.active[entityMeta.votingProcesses.active.length - 1]

    const processId = "0xfbfdb1795eadc8fb8b0249e8a597ab7cc4a6a2a5f3a87db454eadda818cba014"

    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.connect()

    const processMeta = await getProcessMetadata(processId, pool)
    const censusMerkleRoot = processMeta.census.merkleRoot

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

            const publicKeyHash = digestHexClaim(wallet["signingKey"].publicKey)
            const merkleProof = await generateProof(censusMerkleRoot, publicKeyHash, true, pool)
            const votes = [1]
            const voteEnvelope = await packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet })
            // Encrypted version:
            // const voteEnvelope = await packageSignedEnvelope({ votes, merkleProof, processId, walletOrSigner: wallet, encryptionPubKeys: ["6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"] })

            console.log("- Submitting vote envelope")
            await submitEnvelope(voteEnvelope, pool)

            console.log("- Envelope height is now:", await getEnvelopeHeight(processId, pool))
        } catch (err) {
            console.error("- Failed:", err)
        }
    }

    pool.disconnect()
}

async function checkSignature() {
    //const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const wallet = Wallet.fromMnemonic("poverty castle step need baby chair measure leader dress print cruise baby avoid fee sock shoulder rate opinion", PATH)
    // const expectedPublicKey = "0x04d811f8ade566618a667715c637a7f3019f46ae0ffc8b2ec3b16b1f72999e2e2f9e9b50c78ca34175d78942de88798cce5d53569f96579a95ec9bab17c0131d4f"
    // const expectedAddress = "0xe3A0ba4B2Ec804869d9D78857C5c4c6aA493aD00"
    // const body = { "method": "getVisibility", "timestamp": Date.now()}
    //const message = JSON.stringify(body)
    //const signature = await signJsonBody(body, wallet)

    const expectedAddress = await wallet.getAddress()
    const expectedPublicKey = wallet["signingKey"].publicKey

    let body = { "actionKey": "register", "dateOfBirth": "1975-01-25T12:00:00.000Z", "email": "john@me.com", "entityId": "0xf6515536038e12212adc96395021ad1f1f089a239f0ba4c139d364ededd00c54", "firstName": "John", "lastName": "Mayer", "method": "register", "phone": "5555555", "timestamp": 1582821257721 }
    let givenSignature = "0x3086bf3de0d22d2d51f274d4618ea963b60b1e590f5ef0b1a2df17447746d4503f595e87330fb9cc9387c321acc9e476baedfd0681d864f68f4f1bc84548725c1b"

    // let body = { "actionKey": "register", "dateOfBirth": "1975-01-23T12:00:00.000Z", "email": "ferran@me.com", "entityId": "0xf6515536038e12212adc96395021ad1f1f089a239f0ba4c139d364ededd00c54", "firstName": "Ferran", "lastName": "Adrià", "method": "register", "phone": "5555555555", "timestamp": 1582820811597 }
    // let givenSignature = "0x12d77e67c734022f7ab66231377621b75b454d724303bb158019549cf9f02d384d9af1d33266ca017248d8914b111cbb68b7cc9f045e95ccbde5ce389254450f1b"

    const message = JSON.stringify(body)

    const computedSignature = await signJsonBody(body, wallet)

    console.log("Issuing signature\n")
    console.log("- ADDR:        ", expectedAddress)
    console.log("- PUB K:       ", expectedPublicKey)
    console.log("- SIG (given)  ", givenSignature)
    console.log("- SIG (comp)   ", computedSignature)
    console.log()

    // Approach 1
    const isValid = isSignatureValid(givenSignature, expectedPublicKey, body)
    const actualPubKey = recoverSignerPublicKey(body, givenSignature)

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
    await pool.connect()

    console.log("FETCHING CLAIM", process.env.BASE64_CLAIM_DATA)
    console.log("on Merkle Tree", process.env.CENSUS_MERKLE_ROOT)

    const siblings = await generateProof(process.env.CENSUS_MERKLE_ROOT, process.env.BASE64_CLAIM_DATA, true, pool)
    console.log("SIBLINGS:", siblings)

    pool.disconnect()
}

async function gatewayHealthCheck() {
    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    const bootNodeData = await fetchDefaultBootNode(NETWORK_ID)
    const gws = getGatewaysFromBootNodeData(bootNodeData)

    const URL = "https://hnrss.org/newest"
    const response = await axios.get(URL)

    for (let networkId in gws) {
        for (let gw of gws[networkId].dvote) {
            console.log("Checking", gw.getUri())

            await gw.connect()
            const origin = await addFile(response.data, "hn-rss.xml", wallet, gw)
            console.log("STORED ON", origin, "USING", gw.getUri())
            gw.disconnect()
        }

        for (let gw of gws[networkId].web3) {
            console.log("Checking Web3 GW...")

            const instance = await getEntityResolverInstance({ provider: gw.getProvider(), wallet })
            const tx = await instance.setText(myEntityId, "dummy", "1234")
            await tx.wait()
        }
    }
}

async function gatewayRawRequest() {
    const BOOTNODES_URL = " ... "
    const pool = await GatewayPool.discover({ networkId: NETWORK_ID, bootnodesContentUri: BOOTNODES_URL })
    await pool.connect()

    console.log("THE DVOTE GW:", pool.activeGateway().publicKey)

    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const req = { method: "getGatewayInfo" as WsGatewayMethod }  // Low level raw request
    const timeout = 20
    const r = await pool.sendMessage(req, wallet, timeout)
    console.log("RESPONSE:", r)

    // UNSIGNED
    const origin = "ipfs://12341234..."
    console.log("\nReading from", GATEWAY_DVOTE_URI)
    console.log("\nReading", origin)
    const data = await fetchFileString(origin, pool)
    console.log("DATA:", data)

    pool.disconnect()
}

async function ensResolver() {
    // const provider = new providers.EtherscanProvider()
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)

    const resolverAddr = await provider.resolveName("entity-resolver.vocdoni.eth")
    const processAddr = await provider.resolveName("voting-process.vocdoni.eth")

    console.log("Entity Resolver contract address", resolverAddr)
    console.log("Voting Process contract address", processAddr)
}

async function testGatewayInitialization() {
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const ETH_NETWORK_ID = "goerli"
    const BOOTNODES_URL = "https://bootnodes.vocdoni.net/gateways.dev.json"
    let pool, gateway
    let options: GatewayDiscoveryParameters = {
        networkId: ETH_NETWORK_ID,
        bootnodesContentUri: BOOTNODES_URL,
        numberOfGateways: 2,
        race: false,
        timeout: 5000,
    }
    // Pool No race
    console.log("==============================")
    console.time("Pool No race")
    pool = await GatewayPool.discover(options)
    console.timeEnd("Pool No race")
    if (!(await pool.isConnected())) throw new Error("Could not connect to the network")
    console.log("Connected to", await pool.getDVoteUri())
    console.log("Connected to", pool.getProvider().connection.url)

    // Pool Race
    console.log("==============================")
    options.race = true
    console.time("Pool Race")
    pool = await GatewayPool.discover(options)
    console.timeEnd("Pool Race")

    if (!(await pool.isConnected())) throw new Error("Could not connect to the network")
    console.log("Connected to", await pool.getDVoteUri())
    console.log("Connected to", pool.getProvider().connection.url)

    // Default Gateway
    console.log("==============================")
    console.time("Random Gateway from default Bootnode")
    gateway = await Gateway.randomFromDefault(ETH_NETWORK_ID)
    console.timeEnd("Random Gateway from default Bootnode")

    if (!(await gateway.isConnected())) throw new Error("Could not connect to the network")
    console.log("Connected to", await gateway.getDVoteUri())
    console.log("Connected to", gateway.getProvider().connection.url)

    // Gateway from URI
    console.log("==============================")
    console.time("Random Gateway from URI")
    gateway = await Gateway.randomfromUri(ETH_NETWORK_ID, BOOTNODES_URL)
    console.timeEnd("Random Gateway from URI")

    if (!(await gateway.isConnected())) throw new Error("Could not connect to the network")
    console.log("Connected to", await gateway.getDVoteUri())
    console.log("Connected to", gateway.getProvider().connection.url)

    // Gateway from info
    console.log("==============================")
    console.time("Gateway from gatewayInfo")
    const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
    gateway = await Gateway.fromInfo(gwInfo)
    console.timeEnd("Gateway from gatewayInfo")

    if (!(await gateway.isConnected())) throw new Error("Could not connect to the network")
    console.log("Connected to", await gateway.getDVoteUri())
    console.log("Connected to", gateway.getProvider().connection.url)

    return
}

async function main() {
    // Ethereum

    // await deployEntityResolver()
    // await attachToEntityResolver()
    // await deployVotingProcess()
    // await attachToVotingProcess()

    // Vocdoni API's

    // await checkGatewayStatus()
    // await fileDownload("ipfs://QmXLgWLYfa826DSCawfb1R34XBQYzs1z4xiLoChu7hUZyM")
    // await emptyFeedUpload()
    // await fileUpload()
    // await registerEntity()
    // await readEntity()
    // await updateEntityInfo()
    // await gwCensusOperations()
    // await createVotingProcessManual()
    await createVotingProcessFull()

    // await cancelVotingProcess()
    // await showProcessResults()
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
