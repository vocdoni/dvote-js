# DVote JS
DVoteJS aims to provide utility classes and methods to invoke decentralized operations within a voting process. It covers the typical functionality of Client applications, as well as the Process Manager or the Census Manager.

The intended functionality is to interact with a public Ethereum blockchain, to fetch data from a decentralized filesystem, to enforce data schema validity, to prepare vote packages and using decentralized messaging networks through Gateways.

This library implements the protocol defined on https://vocdoni.io/docs/#/architecture/components

## Getting started

```sh
npm install dvote-js ethers
```

- Gateways can serve as a **DVote** gateway and as a **Web3** Gateway
  - `VocGateway` and `Web3Gateway`
- **Signers** and **Wallets** are both used to sign Web3 transactions, as well as authenticating DVote requests

**Ethers.js**

The library depends on [Ethers.js](https://docs.ethers.io/ethers.js/html/) providers, wallets and signers. Ethers.js is fully compatible with Web3.

- To interact with the blockchain, we need a [Provider](https://docs.ethers.io/ethers.js/html/api-providers.html).
- In order to send transactions we need a [Wallet](https://docs.ethers.io/ethers.js/html/api-wallet.html) (with a private key) or a [Signer](https://docs.ethers.io/ethers.js/html/api-wallet.html#signer-api) (like Metamask) to sign them. 

### File API

To upload a file and pin it on IPFS, you need the data as a `String` or o as a `UInt8Array` and a signer. Gateways will probably not let you upload arbitrary data unless you are authorised to do so.

```javascript
const { addFile, fetchFileString } = require("dvote-js")
const { Wallet } = require("ethers")

const GATEWAY_DVOTE_URI = "wss://host:port/dvote"

// Create a wallet to sign requests
const wallet = Wallet.fromMnemonic(MNEMONIC)
console.log("SIGNING FROM ADDRESS", wallet.address)

// Upload the file
const strData = "HELLO WORLD"
const origin = await addFile(Buffer.from(strData), "my-file.txt", wallet, GATEWAY_DVOTE_URI)
console.log("DATA STORED ON:", origin)

// Read the contents back as a string
const data = await fetchFileString(origin, GATEWAY_DVOTE_URI)
console.log("DATA:", data)

// Read the contents back as a byte array
const data = await fetchFileBytes(origin, GATEWAY_DVOTE_URI)
console.log("DATA:", data)
```

### Entity

#### Register or update an Entity:

```javascript
const {
    getEntityResolverInstance,
    getEntityId,
    GatewayURI,
    updateEntity
} = require("dvote-js")

const { Wallet, providers } = require("ethers")

const GATEWAY_DVOTE_URI = "wss://host:443/dvote"
const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const resolverContractAddress = "0x9fa513Df94fF9EAE4b63669F187928d20bd7cE6F"
const MNEMONIC = "..." 

const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

// Attach to the Entity Resolver contract
const resolverInstance = await getEntityResolverInstance({ provider, wallet }, resolverContractAddress)

const myEntityAddress = await wallet.getAddress()
const myEntityId = getEntityId(myEntityAddress)
const jsonMetadata = { ... } // EDIT THIS

// Define the two URI's of the Gateway
const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_ETH_PROVIDER_URI)

// Request the update
const contentUri = await updateEntity(myEntityAddress, resolverContractAddress, jsonMetadata, wallet, gw)

console.log("IPFS ORIGIN:", contentUri)
```

#### Fetch the metadata of an Entity:

```javascript
const {
    getEntityResolverInstance,
    getEntityId,
    GatewayURI,
    getEntityMetadata,
    updateEntity,
    addFile,
    fetchFileString
} = require("dvote-js")

const { Wallet, providers } = require("ethers")

const GATEWAY_DVOTE_URI = "wss://host:443/dvote"
const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const resolverContractAddress = "0x9fa513Df94fF9EAE4b63669F187928d20bd7cE6F"
const MNEMONIC = "..." 

const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

const myEntityAddress = await wallet.getAddress()
const gw = new GatewayURI(GATEWAY_DVOTE_URI, GATEWAY_WEB3_PROVIDER_URI)

const meta = await getEntityMetadata(myEntityAddress, resolverContractAddress, gw)
console.log("JSON METADATA", meta)
```

#### Set ENS text records

```javascript
const {
    getEntityResolverInstance,
    getEntityId,
    GatewayURI,
    getEntityMetadata,
    updateEntity,
    addFile,
    fetchFileString
} = require("dvote-js")

const { Wallet, providers } = require("ethers")

const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const resolverContractAddress = "0x9fa513Df94fF9EAE4b63669F187928d20bd7cE6F"
const MNEMONIC = "..." 

const provider = new providers.JsonRpcProvider(GATEWAY_WEB3_PROVIDER_URI)
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

// Attach to the Entity Resolver contract
const resolverInstance = await getEntityResolverInstance({ provider, wallet }, resolverContractAddress)

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
    .withEntityResolver("0x0123456789012345678901234567890123456789")
    .withVotingPublicKey("...")
    .build(3)  // create 3 voting processess within the new contract

```

Note: This is still under heavy development.

### Mocha

When adding new test suites, don't forget to add a call to `addCompletionHooks()`. Otherwise, the NodeJS process will keep up indefinitely when testing. 

### Simulating future timestamps

If you need a transaction to happen in a future timestamp, use `test/eth-utils > increaseTimestamp()` instead of forcing your code to wait. 

Be aware that from this point, if you use `Date.now()` on the Javascript side, values will not match the timestamp of the blockchain. So make sure to call `getBlockNumber()` and `getBlock(<num>) > timestamp`.

### Testing accounts

Use `test/eth-utils > getAccounts()` to retrieve a list of 10 funded accounts with the following data schema:

```javascript
{
    privateKey: "...",
    address: "0x...",
    provider: <ethers-js-provider>,
    wallet: <ethers-js-wallet>
}
```

These accounts are connected to an in-memory Ganache RPC node.
