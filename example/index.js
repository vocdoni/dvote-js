const axios = require("axios")

console.log("Reading .env (if present)...")
require('dotenv').config()


const {
    API: { File, Entity, Census, Vote },
    Network: { Bootnodes, Gateway, Contracts },
    Wrappers: { GatewayInfo, ContentURI, ContentHashedURI },
    Models: { Entity: { TextRecordKeys } },
    EtherUtils: { Providers, Signers }
} = require("../dist") // require("dvote-js")

const {
    getEntityResolverInstance,
    getVotingProcessInstance,
    deployEntityResolverContract,
    deployVotingProcessContract
} = Contracts

const { getEntityId, getEntityMetadata, updateEntity } = Entity
const { getRoot, addCensus, addClaim, addClaimBulk, digestHexClaim, generateCensusId, generateCensusIdSuffix, publishCensus, importRemote, dump, dumpPlain } = Census
const { DVoteGateway, Web3Gateway } = Gateway
const { getDefaultGateways, getRandomGatewayInfo } = Bootnodes
const { addFile, fetchFileString } = File

const { Wallet, providers, utils } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const entityMetadata = require("./entity-metadata.json")
const processMetadata = require("./process-metadata.json")

const MNEMONIC = process.env.MNEMONIC || "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_PUB_KEY = process.env.GATEWAY_PUB_KEY || "02325f284f50fa52d53579c7873a480b351cc20f7780fa556929f5017283ad2449"
const GATEWAY_DVOTE_URI = process.env.GATEWAY_DVOTE_URI || "wss://myhost/dvote"
const GATEWAY_WEB3_URI = process.env.GATEWAY_WEB3_URI || "https://rpc.slock.it/goerli"
const NETWORK_ID = "goerli"

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

    console.log("Reading 'my-key'")
    const val = await contractInstance.text(myEntityId, "my-key")
    console.log("Value stored on the blockchain:", val)
}

async function deployVotingProcess() {
    const CHAIN_ID = 5
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Deploying Voting Process contract...")
    const contractInstance = await deployVotingProcessContract({ provider, wallet }, [CHAIN_ID])
    await contractInstance.deployTransaction.wait()
    console.log("Voting Process deployed at", contractInstance.address)

    // console.log("Setting chainId = 5 (goerli)")
    // let tx = await contractInstance.setChainId(CHAIN_ID)
    // await tx.wait()

    console.log("Setting genesis")
    tx = await contractInstance.setGenesis("ipfs://ipfs-hash-here!sha3-hash-here")
    await tx.wait()

    console.log("Deployment completed!")
}

async function attachToVotingProcess() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Attaching to contract at from")
    const contractInstance = await getVotingProcessInstance({ provider, wallet })

    console.log("Reading 'genesis'")
    let val = await contractInstance.getGenesis()
    console.log("Value stored on the blockchain:", val)

    console.log("Setting genesis")
    tx = await contractInstance.setGenesis("ipfs://ipfs-hash-2-here!sha3-hash-here")
    await tx.wait()

    console.log("Reading 'genesis'")
    val = await contractInstance.getGenesis()
    console.log("Value stored on the blockchain:", val)
}

async function fileUpload() {
    var gw
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

        const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
        gw = new DVoteGateway(gwInfo)
        await gw.connect()

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        console.error("PUTTING STRING OF LENGTH: ", strData.length)
        const origin = await addFile(Buffer.from(strData), "mobile-org-web-action-example.html", wallet, gw)
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
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity ID", myEntityId)
    const gw = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
    const contentUri = await updateEntity(myEntityAddress, entityMetadata, wallet, gw)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)
}

async function readEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const gw = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)

    console.log("ENTITY ID:", getEntityId(myEntityAddress))
    console.log("GW:", GATEWAY_DVOTE_URI, GATEWAY_WEB3_URI)
    const meta = await getEntityMetadata(myEntityAddress, gw)
    console.log("JSON METADATA\n", meta)
}

async function createVotingProcess() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, ["file"], GATEWAY_WEB3_URI, GATEWAY_PUB_KEY)
    gw = new DVoteGateway(gwInfo)
    await gw.connect()

    console.log("Attaching to contract")
    const contractInstance = await getVotingProcessInstance({ provider, wallet })

    console.log("Uploading metadata...")
    const strData = JSON.stringify(processMetadata)
    const origin = await addFile(Buffer.from(strData), "process-metadata.json", wallet, gw)
    console.log("process-metadata.json\nDATA STORED ON:", origin)

    const metaCuri = new ContentHashedURI(`ipfs://${origin}`)
    metaCuri.setHashFrom(strData)

    const censusCuri = new ContentHashedURI("http://localhost/")
    censusCuri.setHashFrom("")

    console.log("Creating process with parameters:", metaCuri.toString(), "0x0", censusCuri.toString())
    const tx = await contractInstance.create(metaCuri.toString(), "0x0", censusCuri.toString())
    const result = await tx.wait()

    console.log("RESULT", result)
    gw.disconnect()
}

async function checkSignature() {
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
    const message = "Hello dapp"
    const signature = await wallet.signMessage(message)
    const expectedAddress = await wallet.getAddress()
    const expectedPublicKey = wallet.signingKey.publicKey

    console.log("ISSUING SIGNATURE")
    console.log("ADDR:    ", expectedAddress)
    console.log("PUB K:   ", expectedPublicKey)
    console.log("SIG      ", signature)
    console.log()

    // Approach 1
    const actualAddress = utils.verifyMessage(message, signature)

    console.log("APPROACH 1")
    console.log("EXPECTED ADDR: ", expectedAddress)
    console.log("ACTUAL ADDR:   ", actualAddress)
    console.log()

    // Approach 2
    const msgHash = utils.hashMessage(message);
    const msgHashBytes = utils.arrayify(msgHash);

    // Now you have the digest,
    const recoveredPubKey = utils.recoverPublicKey(msgHashBytes, signature);
    const recoveredAddress = utils.recoverAddress(msgHashBytes, signature);

    const matches = expectedPublicKey === recoveredPubKey

    console.log("APPROACH 2")
    console.log("EXPECTED ADDR:    ", expectedAddress)
    console.log("RECOVERED ADDR:   ", recoveredAddress)

    console.log("EXPECTED PUB K:   ", expectedPublicKey)
    console.log("RECOVERED PUB K:  ", recoveredPubKey)

    console.log("SIGNATURE VALID:  ", matches)
    console.log()
}

async function gatewayHealthCheck() {
    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    const gws = await getDefaultGateways("goerli")

    const URL = "https://hnrss.org/newest"
    const response = await axios.get(URL)

    for (let networkId in gws) {
        for (let gw of gws[networkId].dvote) {
            console.log("Checking", gw.uri, "...")

            await gw.connect()
            const origin = await File.addFile(response.data, "hn-rss.xml", wallet, gw)
            console.log("STORED ON", origin, "USING", gw.uri)
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
    // DVOTE
    const gws = await getRandomGatewayInfo()
    gw = new DVoteGateway(gws[NETWORK_ID])
    console.log("THE DVOTE GW:", gw.publicKey)

    await gw.connect()

    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const req = { method: "test" }  // Low level raw request
    const timeout = 20
    const r = await gw.sendMessage(req, wallet, timeout)
    console.log("RESPONSE:", r)

    // UNSIGNED
    const origin = "ipfs://QmUNZNB1u31eoAw1ooqXRGxGvSQg4Y7MdTTLUwjEp86WnE"
    console.log("\nReading from", GATEWAY_DVOTE_URI)
    console.log("\nReading", origin)
    const data = await fetchFileString(origin, gw)
    console.log("DATA:", data)

    gw.disconnect()
}

async function ensResolver() {
    // const provider = new providers.EtherscanProvider()
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_URI)

    const resolverAddr = await provider.resolveName("entity-resolver.vocdoni.eth")
    const processAddr = await provider.resolveName("voting-process.vocdoni.eth")

    console.log("Entity Resolver contract address", resolverAddr)
    console.log("Voting Process contract address", processAddr)
}

async function gwCensusOperations() {
    // SIGNED
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const gw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file", "census"], publicKey: GATEWAY_PUB_KEY })

    await gw.connect()

    const censusName = "My census name " + Math.random().toString().substr(2)
    const adminPublicKeys = [await wallet.signingKey.publicKey]
    const publicKeys = [
        "0412d6dc30db7d2a32dddd0ba080d244cc26fcddcc29beb3fcb369564b468b9927445ab996fecbdd6603f6accbc4b3f773a9fe59b66f6e8ef6d9ecf70d8cee5a73",
        "043980b22e9432aa2884772570c47a6f78a39bcc08b428161a503eeb91f66b1901ece9b82d2624ed5b44fa02922c28080c717f474eca16c54aecd74aba3eb76953",
        "04f64bd4dc997f1eed4f20843730c13d926199ff45a9edfad191feff0cea6e3d54de43867463acdeeaae990ee6882138b79ee33e3ae7e4f2c12dc0a52088bbb620",
        "04b9bd5b6f90833586cfcd181d1abe66d14152bb100ed7ec63ff94ecfe48dab18757177cac4551bc56bcf586d056d0f3709443face6b6bac7c55316e54522b4d2b"
    ]
    let publicKeyDigestedClaims = publicKeys.map(item => digestHexClaim(item))
    publicKeyDigestedClaims[publicKeyDigestedClaims.length-1] = "wrong_value"
    console.log(publicKeyDigestedClaims);

    // Create a census if it doesn't exist
    let result = await addCensus(censusName, adminPublicKeys, gw, wallet)
    console.log(`ADD CENSUS "${censusName}" RESULT:`, result)
    // { censusId: "0x.../0x...", merkleRoot: "0x0..."}

    // Add a claim to the new census
    const censusId = result.censusId
    result = await addClaim(censusId, publicKeyDigestedClaims[0], gw, wallet)
    console.log("ADDED", publicKeyDigestedClaims[0], "TO", censusId)

    // Add claims to the new census
    // const censusId = result.censusId
    result = await addClaimBulk(censusId, publicKeyDigestedClaims.slice(1), gw, wallet)
    console.log("ADDED", publicKeyDigestedClaims.slice(1), "TO", censusId)
    if (result.invalidClaims.length > 0) console.log("INVALID CLAIMS", result.invalidClaims)
    result = await getRoot(censusId, gw)
    console.log("MERKLE ROOT", result)  // 0x....

    result = await publishCensus(censusId, gw, wallet)
    console.log("PUBLISHED", censusId)
    console.log(result)   // ipfs://....

    result = await dump(censusId, gw, wallet)
    console.log("DUMP", result)

    result = await dumpPlain(censusId, gw, wallet)
    console.log("DUMP PLAIN", result)

    gw.disconnect()
}

async function main() {
    // await deployEntityResolver()
    // await attachToEntityResolver()
    // await deployVotingProcess()
    // await attachToVotingProcess()

    // await fileUpload()
    // await registerEntity()
    // await readEntity()
    // await createVotingProcess()
    // await checkSignature()
    // await gatewayHealthCheck()
    // await gatewayRawRequest()
    // await ensResolver()
    await gwCensusOperations()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
