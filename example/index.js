const { EntityResolver, Gateway } = require("..") // require("dvote-js")
const { Wallet } = require("ethers")

const MNEMONIC = ""
const GATEWAY_WS_URI = ""
const GATEWAY_PROVIDER_URI = ""
// const PROVIDER_URL = ""
const resolverContractAddress = ""
const myEntityAddress = ""

async function registerEntity() {
    console.log("Attaching to", resolverContractAddress)

    const EntityResolverFactory = new EntityResolver({ providerUrl: PROVIDER_URL, mnemonic: MNEMONIC })
    const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

    const entityId = EntityResolver.getEntityId(myEntityAddress)
    console.log("Entity ID", entityId)

    console.log("Setting values. Please wait...")

    // setting values
    let tx = await resolverInstance.setText(entityId, "vnd.vocdoni.entity-name", "My official entity")
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.languages", JSON.stringify(["en", "fr"]))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.meta", 'bzz://12345,ipfs://12345')
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.voting-contract", '0x0')
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.gateway-update", JSON.stringify({ "timeout": 60000, "topic": "vocdoni-gateway-update", "difficulty": 1000 }))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.process-ids.active", JSON.stringify([]))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.process-ids.ended", JSON.stringify([]))
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.news-feed.en", "https://hipsterpixel.co/feed.json")
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.news-feed.fr", "https://feed2json.org/convert?url=http://www.intertwingly.net/blog/index.atom")
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.entity-description.en", "The description of my entity goes here")
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.entity-description.fr", "La description officielle de mon organisation est ici")
    await tx.wait()
    tx = await resolverInstance.setText(entityId, "vnd.vocdoni.avatar", "https://hipsterpixel.co/assets/favicons/apple-touch-icon.png")
    await tx.wait()

    // show stored values
    console.log("\nDone!\n")

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function readEntity() {
    console.log("Attaching to", resolverContractAddress)

    const EntityResolverFactory = new EntityResolver({ providerUrl: PROVIDER_URL, mnemonic: MNEMONIC })
    const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)
    const entityId = EntityResolver.getEntityId(myEntityAddress)

    console.log("vnd.vocdoni.entity-name =", await resolverInstance.text(entityId, "vnd.vocdoni.entity-name"));
    console.log("vnd.vocdoni.languages =", await resolverInstance.text(entityId, "vnd.vocdoni.languages"));
    console.log("vnd.vocdoni.meta =", await resolverInstance.text(entityId, "vnd.vocdoni.meta"));
    console.log("vnd.vocdoni.voting-contract =", await resolverInstance.text(entityId, "vnd.vocdoni.voting-contract"));
    console.log("vnd.vocdoni.gateway-update =", await resolverInstance.text(entityId, "vnd.vocdoni.gateway-update"));
    console.log("vnd.vocdoni.process-ids.active =", await resolverInstance.text(entityId, "vnd.vocdoni.process-ids.active"));
    console.log("vnd.vocdoni.process-ids.ended =", await resolverInstance.text(entityId, "vnd.vocdoni.process-ids.ended"));
    console.log("vnd.vocdoni.news-feed.en =", await resolverInstance.text(entityId, "vnd.vocdoni.news-feed.en"));
    console.log("vnd.vocdoni.news-feed.fr =", await resolverInstance.text(entityId, "vnd.vocdoni.news-feed.fr"));
    console.log("vnd.vocdoni.entity-description.en =", await resolverInstance.text(entityId, "vnd.vocdoni.entity-description.en"));
    console.log("vnd.vocdoni.entity-description.fr =", await resolverInstance.text(entityId, "vnd.vocdoni.entity-description.fr"));
    console.log("vnd.vocdoni.avatar =", await resolverInstance.text(entityId, "vnd.vocdoni.avatar"));

    // ensure to disconnect if using WS
    if (resolverInstance.provider.polling) resolverInstance.provider.polling = false
}

async function fetchRemoteFile() {
    const wallet = Wallet.fromMnemonic(MNEMONIC)

    const gw = new Gateway(GATEWAY_WS_URI)

    const result = await gw.addFile("SGVsbG8gVm9jZG9uaQo=", "hello.txt", "ipfs", wallet)
    console.log("ORIGIN", result)

    // const data = await gw.fetchFile("QmYJWvsxyABqd5mnyKbwr7KCFs2uotBGDEwerSYyjtKS7M") // hello
    const data = await gw.fetchFile("QmXGXxhh84PxoKTwFUofSE3RcuPpJjs56aTbxPMzLS6Cha")
    // const data = await gw.fetchFile("ipfs://QmXGXxhh84PxoKTwFUofSE3RcuPpJjs56aTbxPMzLS6Cha")
    // const data = await gw.fetchFile("ipfs://QmXGXxhh84PxoKTwFUofSE3RcuPpJjs56aTbxPMzLS6Cha")
    console.log("DATA", data)

    gw.disconnect()
}

async function fetchBlockchainData() {
    const provider = Gateway.ethereumProvider(GATEWAY_PROVIDER_URI)

    const EntityResolverFactory = new EntityResolver({ provider })
    const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

    const entityId = EntityResolver.getEntityId(myEntityAddress)
    console.log("Entity ID", entityId)

    console.log("vnd.vocdoni.entity-name =", await resolverInstance.text(entityId, "vnd.vocdoni.entity-name"));
    console.log("vnd.vocdoni.languages =", await resolverInstance.text(entityId, "vnd.vocdoni.languages"));
    console.log("vnd.vocdoni.meta =", await resolverInstance.text(entityId, "vnd.vocdoni.meta"));
}

async function main() {
    // await registerEntity()
    // await readEntity()
    // await fetchRemoteFile()
    await fetchBlockchainData()
}

main()
    .then(() => console.log("DONE"))
    .catch(err => console.error(err))
