const {
    getEntityResolverInstance,
    deployEntityContract,
    getEntityId,
    VocGateway,
    GatewayURI,
    getEntityMetadata,
    updateEntity,
    addFile,
    fetchFileString
} = require("..") // require("dvote-js")

const { Wallet, providers, utils } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const jsonMetadata = require("./metadata.json")
// const MNEMONIC = "payment scare exotic code enter party soul ignore horse glove myself ignore"
const MNEMONIC = "bar bundle start frog dish gauge square subway load easily south bamboo"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_PUB_KEY = ""
// const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const GATEWAY_WEB3_PROVIDER_URI = "http://127.0.0.1:8545"
const resolverContractAddress = "0x21f7DcCd9D1ce4C3685A5c50096265A8db4103b4"

async function deployEntityResolver() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    console.log("Deploying contract...")
    const contractInstance = await deployEntityContract({ provider, wallet })
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

    console.log("Attaching to contract at", resolverContractAddress)
    const contractInstance = await getEntityResolverInstance({ provider, wallet }, resolverContractAddress)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity Address:", myEntityAddress)
    console.log("Entity ID:", myEntityId)

    console.log("Reading 'my-key'")
    const val = await contractInstance.text(myEntityId, "my-key")
    console.log("Value stored on the blockchain:", val)
}

async function registerEntity() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity ID", myEntityId)
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_WEB3_PROVIDER_URI)
    const contentUri = await updateEntity(myEntityAddress, resolverContractAddress, jsonMetadata, wallet, gw)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)
}

async function readEntity() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

    const myEntityAddress = await wallet.getAddress()
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_WEB3_PROVIDER_URI)

    const meta = await getEntityMetadata(myEntityAddress, resolverContractAddress, gw)
    console.log("JSON METADATA\n", meta)
}

async function fileUpload() {
    var gw
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC)
        gw = new VocGateway(GATEWAY_DVOTE_URI, GATEWAY_PUB_KEY || null)

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
    const response = {
        "id": "16ba55c30a8f3b7d212512e31ac0e8aba927a25ce03b592ee6c49091acad63ee",
        "response": {
            "request": "16ba55c30a8f3b7d212512e31ac0e8aba927a25ce03b592ee6c49091acad63ee",
            "timestamp": 1563458688772935070,
            "uri": "ipfs://QmQ9exgKoEfC8NrmXRQTvejbB1d6mZApmNWAe5MQ1ZMX1C"
        },
        "signature": "0x1b5a3a555d1f4b7ee9dad8cd87b02d551638f433c648e86fad0bc7356218939b170c74276442aa061d5d1afe7fb65a85591d67cbca130ba79cfde1982364fe4500"
    }
    const strBody = JSON.stringify(response.response)

    const expectedPublicKey = "02325f284f50fa52d53579c7873a480b351cc20f7780fa556929f5017283ad2449"
    const expectedAddress = utils.computeAddress("0x" + expectedPublicKey)

    const actualAddress = utils.verifyMessage(strBody, response.signature)

    console.log("EXPECTED", expectedAddress)
    console.log("ACTUAL", actualAddress)
}

async function main() {
    // await deployEntityResolver()
    await attachToEntityResolver()

    // await registerEntity()
    // await readEntity()
    // await fileUpload()
    // checkSignature()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
