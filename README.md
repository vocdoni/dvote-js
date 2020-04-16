# DVote JS
DVoteJS aims to provide utility classes and methods to invoke decentralized operations within a voting process. It covers the typical functionality of Client applications, as well as the Process Manager or the Census Manager.

The intended functionality is to interact with a public Ethereum blockchain, to fetch data from a decentralized filesystem, to enforce data schema validity, to prepare vote packages and using decentralized messaging networks through Gateways.

This library implements the protocol defined on https://vocdoni.io/docs/#/architecture/components

## Getting started

```sh
npm install dvote-js ethers
```

- Gateways can serve as a **DVote** gateway, **Census** gateway and as a **Web3** Gateway
  - `DVoteGateway`, `CensysGateway` and `Web3Gateway`
- **Signers** and **Wallets** are both used to sign Web3 transactions, as well as authenticating DVote requests

**Ethers.js**

The library depends on [Ethers.js](https://docs.ethers.io/ethers.js/html/) providers, wallets and signers. Ethers.js is fully compatible with Web3.

- To interact with the blockchain, we need a [Provider](https://docs.ethers.io/ethers.js/html/api-providers.html).
- In order to send transactions we need a [Wallet](https://docs.ethers.io/ethers.js/html/api-wallet.html) (with a private key) or a [Signer](https://docs.ethers.io/ethers.js/html/api-wallet.html#signer-api) (like Metamask) to sign them. 

### File API

To upload a file and pin it on IPFS, you need the data as a `String` or o as a `UInt8Array` and a signer. Gateways will probably not let you upload arbitrary data unless you are authorised to do so.

```javascript

const {
    API: { File: { addFile, fetchFileString }, Entity, Census, Vote },
    Network: { Bootnodes, Gateway, Contracts }
} = require("dvote-js")

const { Wallet } = require("ethers")

const MNEMONIC = "..."
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_DVOTE_URI = "wss://host:port/dvote"
const GATEWAY_PUB_KEY = "02..."

const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

dvoteGw = new DVoteGateway({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file"], publicKey: GATEWAY_PUB_KEY })
await dvoteGw.connect()

// Wallet to sign requests
const wallet = Wallet.fromMnemonic(MNEMONIC)
console.log("SIGNING FROM ADDRESS", wallet.address)

// Upload the file
const strData = "HELLO WORLD"
const origin = await addFile(Buffer.from(strData), "my-file.txt", wallet, dvoteGw)
console.log("DATA STORED ON:", origin)

// Read the contents back as a string
const data = await fetchFileString(origin, dvoteGw)
console.log("DATA:", data)

// Read the contents back as a byte array
const data = await fetchFileBytes(origin, dvoteGw)
console.log("DATA:", data)

dvoteGw.disconnect()
```

### Entity

#### Register or update an Entity:

```javascript
const {
    API: { File, Entity, Census, Vote },
    Network: { Bootnodes, Gateway, Contracts },
    Wrappers: { GatewayInfo, ContentURI, ContentHashedURI },
    // EtherUtils: { Providers, Signers }
} = require("dvote-js")

const {
    getEntityResolverInstance,
    // getVotingProcessInstance,
    // deployEntityResolverContract,
    // deployVotingProcessContract
} = Contracts
const { getEntityId, getEntityMetadataByAddress, updateEntity } = Entity
const { DVoteGateway, Web3Gateway } = Gateway
const { getRandomGatewayInfo } = Bootnodes
const { Wallet, providers } = require("ethers")

const MNEMONIC = "..." 

// Use a random GW from Vocdoni
const gwInfo = await getRandomGatewayInfo()
const web3Gw = new Web3Gateway(gwInfo["goerli"])
const dvoteGw = new DVoteGateway(gwInfo["goerli"])
await dvoteGw.connect()

const provider = web3Gw.getProvider()
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

// Attach to the Entity Resolver contract
const resolverInstance = await getEntityResolverInstance({ provider, wallet })

const myEntityAddress = await wallet.getAddress()
const myEntityId = getEntityId(myEntityAddress)
const jsonMetadata = { ... } // EDIT THIS

// Request the update
const contentUri = await updateEntity(myEntityAddress, jsonMetadata, wallet, web3Gw, dvoteGw)

console.log("IPFS ORIGIN:", contentUri)

gw.disconnect()
```

#### Fetch the metadata of an Entity:

```javascript
const {
    API: { File, Entity, Census, Vote },
    Network: { Bootnodes, Gateway: { DVoteGateway, Web3Gateway }, Contracts },
    Wrappers: { GatewayInfo, ContentURI, ContentHashedURI },
    // EtherUtils: { Providers, Signers }
} = require("dvote-js")

const {
    getEntityResolverInstance,
    // getVotingProcessInstance,
    // deployEntityResolverContract,
    // deployVotingProcessContract
} = Contracts
const { getEntityId, getEntityMetadataByAddress, updateEntity } = Entity
const { addFile, fetchFileString } = File

const { Wallet, providers } = require("ethers")

const GATEWAY_DVOTE_URI = "wss://host:443/dvote"
const GATEWAY_SUPPORTED_APIS = ["file", "vote", "census"]
const GATEWAY_PUBLIC_KEY = "03..."
const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const MNEMONIC = "..." 

const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

const myEntityAddress = await wallet.getAddress()
const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, GATEWAY_SUPPORTED_APIS, GATEWAY_WEB3_PROVIDER_URI, GATEWAY_PUBLIC_KEY)
const web3Gw = new Web3Gateway(gwInfo)
const dvoteGw = new DVoteGateway(gwInfo)
await dvoteGw.connect()

const meta = await getEntityMetadataByAddress(myEntityAddress, web3Gw, dvoteGw)
console.log("JSON METADATA", meta)

dvoteGw.disconnect()
```

#### Set ENS text records

```javascript
const {
    API: { File, Entity, Census, Vote },
    Network: { Bootnodes, Gateway, Contracts },
    Wrappers: { GatewayInfo, ContentURI, ContentHashedURI },
    // EtherUtils: { Providers, Signers }
} = require("dvote-js")

const {
    getEntityResolverInstance,
    // getVotingProcessInstance,
    // deployEntityResolverContract,
    // deployVotingProcessContract
} = Contracts
const { getEntityId, getEntityMetadataByAddress, updateEntity } = Entity
const { addFile, fetchFileString } = File

const { Wallet, providers } = require("ethers")

const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const MNEMONIC = "..." 

const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

// Attach to the Entity Resolver contract
const resolverInstance = await getEntityResolverInstance({ provider, wallet })

const myEntityAddress = await wallet.getAddress()
const myEntityId = getEntityId(myEntityAddress)

// Set an ENS Text record
const tx = await contractInstance.setText(myEntityId, "my-key", "1234")
await tx.wait()

// Read the value
const val = await contractInstance.text(myEntityId, "my-key")
console.log("Value stored on the blockchain:", val)
```


### Using providers

Ethers.js providers can connect using different sources.

```javascript
const ethers = require("ethers")   // NodeJS
import { ethers } from "ethers"    // ES6 Browser

// Well-known
const provider = ethers.getDefaultProvider('homestead') // mainnet

// Etherscan
const altProvider = new ethers.providers.EtherscanProvider('ropsten')

// Using injected web3 on a browser
const web3Provider1 = new ethers.providers.Web3Provider(web3.currentProvider)

const currentProvider2 = new web3.providers.HttpProvider('http://localhost:8545')
const web3Provider2 = new ethers.providers.Web3Provider(currentProvider2)
```

[More information](https://docs.ethers.io/ethers.js/html/api-providers.html#connecting-to-ethereum)

### Wallets

Generating a wallet from a mnemonic (and an optional path and Web3 provider):

```typescript
const mnemonic = "my mnemonic ..."
const mnemonicPath = "m/44'/60'/0'/0/0"
const provider = ethers.getDefaultProvider('goerli')

const wallet = walletFromMnemonic(mnemonic, mnemonicPath, provider)
wallet.sendTransaction(...)
// ...
```

Generating a standalone deterministic wallet from a passphrase and a (non-private) seed. They are intended to provide wallets where the private key can be accessed.

```typescript
const provider = ethers.getDefaultProvider('goerli')

// Created from scratch
const hexSeed = generateRandomHexSeed()  // could be stored locally
const passphrase = "A very Difficult 1234 passphrase" // must be private and include upper/lowercase chars and numbers

// Or using an already created seed
const hexSeed = "0xfdbc446f9f3ea732d23c7bcd10c784d041887d48ebc392c4ff51882ae569ca15"
const passphrase = "A very Difficult 1234 passphrase" // must be private and include upper/lowercase chars and numbers

const wallet = walletFromSeededPassphrase(passphrase, hexSeed, provider)
wallet.signMessage(...)
// ...
```

Accessing the browser wallet or MetaMask:

```typescript
const signer = signerFromBrowserProvider()
signer.sendTransaction(...)
```

## Components

### Entity Resolver

Mainly used to query the metadata of an Entity on a ENS resolver, but also used to set and update its values.

### Voting Process

Mainly used to query the metadata of a voting process within the contract instance. Also used to create votes, publish batches and get the encryption keys.

### Gateway

Provides utility functions to fetch data from decentralized filesystems, sending messages and adding files to IPFS. 

## Example

Check out `example/index.js`.

## Development

Simply run `npm run test`. It is an alias for `npm run test:unit` and `npm run test:integration`.

- Unit testing will start an internal Ganache provider and launch transactions to it
- Integration testing is still a WIP

### Builders

In order to avoid tedious and repetitive testing code, you can check out the `test/builders` folder. Entity and Process builders deploy a new instance and create an Entity/Process with default values. These default values can be overridden with one-liners, if needed:

```javascript
const EntityBuilder = require("./test/builders/entity-resolver")
const VoteBuilder = require("./test/builders/voting-process")

const contractInstance1 = await new EntityBuilder().build()
const contractInstance2 = await new VotingProcessBuilder().build()

const contractInstance3 = await new EntityBuilder()
    .withName("Another name")
    .build()

const contractInstance4 = await new VotingProcessBuilder()
    .withVotingPublicKey("...")
    .build(3)  // create 3 voting processess within the new contract

```

Note: This is still under heavy development.

### Mocha

When adding new test suites, don't forget to add a call to `addCompletionHooks()`. Otherwise, the NodeJS process will keep up indefinitely when testing. 

### Simulating future timestamps

If you need a transaction to happen in a future timestamp, use `test/testing-eth-utils > increaseTimestamp()` instead of forcing your code to wait. 

Be aware that from this point, if you use `Date.now()` on the Javascript side, values will not match the timestamp of the blockchain. So make sure to call `getBlockNumber()` and `getBlock(<num>) > timestamp`.

### Testing accounts

Use `test/testing-eth-utils > getAccounts()` to retrieve a list of 10 funded accounts with the following data schema:

```javascript
{
    privateKey: "...",
    address: "0x...",
    provider: <ethers-js-provider>,
    wallet: <ethers-js-wallet>
}
```

These accounts are connected to an in-memory Ganache RPC node.
