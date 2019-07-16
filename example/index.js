const {
    getEntityResolverInstance,
    deployEntityContract,
    getEntityId,
    GatewayURI,
    getEntityMetadata,
    updateEntity,
    addFile,
    fetchFileString
} = require("..") // require("dvote-js")
const { Wallet, providers } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const jsonMetadata = require("./metadata.json")
const MNEMONIC = "payment scare exotic code enter party soul ignore horse glove myself ignore"
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_DVOTE_URI = "ws://host/dvote"
const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
// const GATEWAY_WEB3_PROVIDER_URI = "http://127.0.0.1:8545"
const resolverContractAddress = "0x9fa513Df94fF9EAE4b63669F187928d20bd7cE6F"

async function deployEntityResolver() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

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
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

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
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

    console.log("Attaching the Entity Resolver:", resolverContractAddress)
    const resolverInstance = await getEntityResolverInstance({ provider, wallet }, resolverContractAddress)

    const myEntityAddress = await wallet.getAddress()
    const myEntityId = getEntityId(myEntityAddress)

    console.log("Entity ID", myEntityId)
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_ETH_PROVIDER_URI)
    const contentUri = await updateEntity(myEntityAddress, resolverContractAddress, jsonMetadata, wallet, gw)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function readEntity() {
    const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

    const myEntityAddress = await wallet.getAddress()
    const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_WEB3_PROVIDER_URI)

    const meta = await getEntityMetadata(myEntityAddress, resolverContractAddress, gw)
    console.log("JSON METADATA\n", meta)
}

async function fileUpload() {
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC)

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        const origin = await addFile(Buffer.from(strData), "mobile-org-web-action-example.html", wallet, GATEWAY_DVOTE_URI)
        console.log("mobile-org-web-action-example.html\nDATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await fetchFileString(origin, GATEWAY_DVOTE_URI)
        console.log("DATA:", data.toString())

    } catch (err) {
        console.error(err)
    }
}

async function main() {
    // await deployEntityResolver()
    // await attachToEntityResolver()

    await registerEntity()
    // await readEntity()
    // await fileUpload()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
