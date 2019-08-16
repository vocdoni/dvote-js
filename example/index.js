const {
    getEntityResolverContractInstance,
    getVotingProcessContractInstance,
    deployEntityResolverContract,
    deployVotingProcessContract,
    getEntityId,
    DVoteGateway,
    CensusGateway,
    GatewayURI,
    getEntityMetadata,
    updateEntity,
    addFile,
    fetchFileString
} = require("..") // require("dvote-js")

const { Wallet, providers, utils } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const jsonMetadata = require("./entity-metadata.json")
// const MNEMONIC = "payment scare exotic code enter party soul ignore horse glove myself ignore"
const MNEMONIC = "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_PUB_KEY = "02325f284f50fa52d53579c7873a480b351cc20f7780fa556929f5017283ad2449"
const GATEWAY_DVOTE_URI = "wss://host/dvote"
const GATEWAY_CENSUS_URI = "wss://host/census"
// const GATEWAY_WEB3_PROVIDER_URI = "https://host/web3"
const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
// const GATEWAY_WEB3_PROVIDER_URI = "http://127.0.0.1:8545"
const ENTITY_RESOLVER_CONTRACT_ADDRESS = "0xF6B058613DD7C8a55eE07Fd4a0a66CfD662F36E9"
const VOTING_PROCESS_CONTRACT_ADDRESS = "0xea7D210f6975616f2F7B2D6360f91f2378E5E144"

async function deployEntityResolver() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
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
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Attaching to contract at", ENTITY_RESOLVER_CONTRACT_ADDRESS)
    const contractInstance = await getEntityResolverContractInstance({ provider, wallet }, ENTITY_RESOLVER_CONTRACT_ADDRESS)

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
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
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
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Attaching to contract at", VOTING_PROCESS_CONTRACT_ADDRESS)
    const contractInstance = await getVotingProcessContractInstance({ provider, wallet }, VOTING_PROCESS_CONTRACT_ADDRESS)

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

async function registerEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity ID", myEntityId)
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_CENSUS_URI, GATEWAY_WEB3_PROVIDER_URI)
    const contentUri = await updateEntity(myEntityAddress, ENTITY_RESOLVER_CONTRACT_ADDRESS, jsonMetadata, wallet, gw)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)
}

async function readEntity() {
    // const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_CENSUS_URI, GATEWAY_WEB3_PROVIDER_URI)

    console.log("ENTITY ID:", getEntityId(myEntityAddress))
    console.log("RESOLVER:", ENTITY_RESOLVER_CONTRACT_ADDRESS)
    console.log("GW:", GATEWAY_DVOTE_URI, GATEWAY_CENSUS_URI, GATEWAY_WEB3_PROVIDER_URI)
    const meta = await getEntityMetadata(myEntityAddress, ENTITY_RESOLVER_CONTRACT_ADDRESS, gw)
    console.log("JSON METADATA\n", meta)
}

async function fileUpload() {
    var gw
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC)
        gw = new DVoteGateway(GATEWAY_DVOTE_URI, GATEWAY_PUB_KEY || null)

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        const origin = await addFile(Buffer.from(strData), "mobile-org-web-action-example.html", wallet, gw)
        console.log("mobile-org-web-action-example.html\nDATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await fetchFileString(origin, gw)
        console.log("DATA:", data)

        gw.disconnect()
    } catch (err) {
        if (gw) gw.disconnect()
        console.error(err)
    }
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

async function gatewayRequest() {
    // DVOTE
    let gw = new DVoteGateway(GATEWAY_DVOTE_URI, GATEWAY_PUB_KEY)
    console.log("THE VOC GW:", gw.publicKey)
    // const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    // const req = { a: 1 }
    // const r = await gw.sendMessage(req, wallet, 10)

    const origin = "ipfs://QmUNZNB1u31eoAw1ooqXRGxGvSQg4Y7MdTTLUwjEp86WnE"
    console.log("\nReading from", GATEWAY_DVOTE_URI)
    console.log("\nReading", origin)
    const data = await fetchFileString(origin, gw)
    console.log("DATA:", data)

    // console.log("Sending:", req)
    // console.log("Got:", r)
    gw.disconnect()
}

async function main() {
    // await deployEntityResolver()
    // await attachToEntityResolver()
    // await deployVotingProcess()
    await attachToVotingProcess()

    // await registerEntity()
    // await readEntity()
    // await fileUpload()
    // await checkSignature()
    // await gatewayRequest()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
