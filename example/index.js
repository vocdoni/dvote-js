const { EntityResolver, Gateway } = require("..") // require("dvote-js")
const { Wallet } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const jsonMetadata = require("./metadata.json")
const MNEMONIC = "... mnemonic ..."
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_DVOTE_URI = "ws://host:2082/dvote"
const GATEWAY_ETH_PROVIDER_URI = "http://host:2086/path"
const resolverContractAddress = "0x1234"
let myEntityAddress

async function registerEntity() {
    console.log("Attaching the instance of Entity Resolver:", resolverContractAddress)

    const provider = Gateway.ethereumProvider(GATEWAY_ETH_PROVIDER_URI)
    const resolver = new EntityResolver({ provider, mnemonic: MNEMONIC, mnemonicPath: PATH })
    const resolverInstance = resolver.attach(resolverContractAddress)

    myEntityAddress = await resolver.wallet.getAddress()
    myEntityId = EntityResolver.getEntityId(myEntityAddress)
    console.log("Entity ID", myEntityId)

    const contentUri = await resolver.updateEntity(myEntityAddress, jsonMetadata, GATEWAY_DVOTE_URI)

    // show stored values
    console.log("\nEntity registered!\n")
    console.log("The JSON metadata should become generally available in a few minutes")
    console.log(contentUri)

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function readEntity() {
    console.log("Attaching the instance of Entity Resolver:", resolverContractAddress)

    const provider = Gateway.ethereumProvider(GATEWAY_ETH_PROVIDER_URI)
    const resolver = new EntityResolver({ provider, mnemonic: MNEMONIC, mnemonicPath: PATH })
    const resolverInstance = resolver.attach(resolverContractAddress)

    myEntityAddress = await resolver.wallet.getAddress()

    const meta = await resolver.getMetadata(myEntityAddress, GATEWAY_DVOTE_URI)
    console.log("JSON METADATA\n", meta)

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function fileUpload() {
    let gw
    try {
        const wallet = Wallet.fromMnemonic(MNEMONIC)
        gw = new Gateway(GATEWAY_DVOTE_URI)

        console.log("SIGNING FROM ADDRESS", wallet.address)

        const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
        const origin = await gw.addFile(Buffer.from(strData), "mobile-org-web-action-example.html", "ipfs", wallet)
        console.log("mobile-org-web-action-example.html\nDATA STORED ON:", origin)

        console.log("\nReading back", origin)
        const data = await gw.fetchFile(origin)
        console.log("DATA:", data.toString())

        gw.disconnect()
    } catch (err) {
        console.error(err)
        if (gw) gw.disconnect()
    }
}

async function remoteFetch() {
    const wallet = Wallet.fromMnemonic(MNEMONIC)
    const gw = new Gateway(GATEWAY_DVOTE_URI)

    const strData = "HI THERE"
    const origin = await gw.addFile(Buffer.from(strData), "my-data.txt", "ipfs", wallet)
    console.log("DATA STORED ON:", origin)

    console.log("\nREADING", origin)
    // const data = await gw.fetchFile("QmYJWvsxyABqd5mnyKbwr7KCFs2uotBGDEwerSYyjtKS7M") // hello
    // const data = await gw.fetchFile("QmXGXxhh84PxoKTwFUofSE3RcuPpJjs56aTbxPMzLS6Cha")
    // const data = await gw.fetchFile("ipfs://QmXGXxhh84PxoKTwFUofSE3RcuPpJjs56aTbxPMzLS6Cha")
    const data = await gw.fetchFile(origin)
    console.log("DATA:", data.toString())

    gw.disconnect()
}


async function main() {
    await registerEntity()
    await readEntity()
    // await fileUpload()
    // await remoteFetch()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
