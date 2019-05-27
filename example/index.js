const { EntityResolver, Gateway } = require("..") // require("dvote-js")
const { Wallet } = require("ethers")
const { Buffer } = require("buffer/")
const fs = require("fs")

const jsonMetadata = require("./metadata.json")
const MNEMONIC = "..."
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_VOC_URI = "ws://host:2000/dvote"
const GATEWAY_ETH_PROVIDER_URI = "http://host:2001/web3"
const resolverContractAddress = "0x..."
let myEntityAddress

async function registerEntity() {
    console.log("Attaching to instance", resolverContractAddress)

    const provider = Gateway.ethereumProvider(GATEWAY_ETH_PROVIDER_URI)
    const EntityResolverFactory = new EntityResolver({ provider, mnemonic: MNEMONIC, mnemonicPath: PATH })
    const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

    myEntityAddress = await EntityResolverFactory.wallet.getAddress()
    const entityId = EntityResolver.getEntityId(myEntityAddress)
    console.log("Entity ID", entityId)

    const wallet = Wallet.fromMnemonic(MNEMONIC)
    const gw = new Gateway(GATEWAY_VOC_URI)
    const strMetadata = JSON.stringify(jsonMetadata)
    const metaOrigin = await gw.addFile(Buffer.from(strMetadata), "my-entity-metadata.json", "ipfs", wallet)
    console.log("ORIGIN", metaOrigin)

    console.log("Setting values. Please wait...")

    // setting values
    let tx = await resolverInstance.setText(entityId, "vnd.vocdoni.entity-name", jsonMetadata["entity-name"])
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.languages", JSON.stringify(jsonMetadata.languages))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.meta", metaOrigin)
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.voting-contract", jsonMetadata['voting-contract'])
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.gateway-update", JSON.stringify(jsonMetadata['gateway-update']))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.process-ids.active", JSON.stringify(jsonMetadata['process-ids']['active']))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.process-ids.ended", JSON.stringify(jsonMetadata['process-ids']['ended']))
    await tx.wait()

    for (let lang of jsonMetadata.languages) {
        tx = await resolverInstance.setText(entityId, `vnd.vocdoni.news-feed.${lang}`, jsonMetadata['news-feed'][lang])
        await tx.wait()
        tx = await resolverInstance.setText(entityId, `vnd.vocdoni.entity-description.${lang}`, jsonMetadata['entity-description'][lang])
        await tx.wait()
    }

    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.avatar", jsonMetadata["avatar"])
    await tx.wait()

    // show stored values
    console.log("\nEntity registered!\n")

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
    gw.disconnect()
}

async function readEntity() {
    console.log("Attaching to instance", resolverContractAddress)

    const provider = Gateway.ethereumProvider(GATEWAY_ETH_PROVIDER_URI)
    const EntityResolverFactory = new EntityResolver({ provider, mnemonic: MNEMONIC, mnemonicPath: PATH })
    const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

    myEntityAddress = await EntityResolverFactory.wallet.getAddress()
    const entityId = EntityResolver.getEntityId(myEntityAddress)
    console.log("Entity ID", entityId)

    const langs = JSON.parse(await resolverInstance.text(entityId, "vnd.vocdoni.languages"))
    console.log("vnd.vocdoni.languages =", langs);

    console.log("vnd.vocdoni.entity-name =", await resolverInstance.text(entityId, "vnd.vocdoni.entity-name"));
    console.log("vnd.vocdoni.meta =", await resolverInstance.text(entityId, "vnd.vocdoni.meta"));
    console.log("vnd.vocdoni.voting-contract =", await resolverInstance.text(entityId, "vnd.vocdoni.voting-contract"));
    console.log("vnd.vocdoni.gateway-update =", await resolverInstance.text(entityId, "vnd.vocdoni.gateway-update"));
    console.log("vnd.vocdoni.process-ids.active =", await resolverInstance.text(entityId, "vnd.vocdoni.process-ids.active"));
    console.log("vnd.vocdoni.process-ids.ended =", await resolverInstance.text(entityId, "vnd.vocdoni.process-ids.ended"));

    for (let lang of langs) {
        console.log(`vnd.vocdoni.news-feed.${lang} =`, await resolverInstance.text(entityId, `vnd.vocdoni.news-feed.${lang}`));
        console.log(`vnd.vocdoni.entity-description.${lang} =`, await resolverInstance.text(entityId, `vnd.vocdoni.entity-description.${lang}`));
    }

    console.log("vnd.vocdoni.avatar =", await resolverInstance.text(entityId, "vnd.vocdoni.avatar"));

    const meta = await EntityResolverFactory.getJsonMetadata(myEntityAddress, GATEWAY_VOC_URI)
    console.log("JSON METADATA\n", meta)

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function fileUpload() {
    const wallet = Wallet.fromMnemonic(MNEMONIC)
    const gw = new Gateway(GATEWAY_VOC_URI)

    const strData = fs.readFileSync(__dirname + "/mobile-org-web-action-example.html").toString()
    const origin = await gw.addFile(Buffer.from(strData), "mobile-org-web-action-example.html", "ipfs", wallet)
    console.log("mobile-org-web-action-example.html\nDATA STORED ON:", origin)

    console.log("\nReading back", origin)
    const data = await gw.fetchFile(origin)
    console.log("DATA:", data.toString())

    gw.disconnect()
}

async function remoteFetch() {
    const wallet = Wallet.fromMnemonic(MNEMONIC)
    const gw = new Gateway(GATEWAY_VOC_URI)

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
    // await registerEntity()
    await readEntity()
    // await fileUpload()
    // await remoteFetch()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
