# DVote JS

DVoteJS aims to provide utility classes and methods to invoke decentralized operations within a voting process. It covers the typical functionality of Client applications, as well as the Process Manager or the Census Manager.

The intended functionality is to interact with a public Ethereum blockchain, to fetch data from a decentralized filesystem, to enforce data schema validity, to prepare vote packages and using decentralized messaging networks through Gateways.

This library implements the protocol defined on https://docs.vocdoni.io/architecture/components.html

## Getting started

```sh
npm install dvote-js ethers
```

- Gateways can serve as a **DVote** gateway and as a **Web3** Gateway
  - `DVoteGateway` and `Web3Gateway`
- **Signers** and **Wallets** are both used to sign Web3 transactions, as well as authenticating DVote requests

**Ethers.js**

The library depends on [Ethers.js](https://docs.ethers.io/ethers.js/html/) providers, wallets and signers. Ethers.js is fully compatible with Web3.

- To interact with the blockchain, we need a [Provider](https://docs.ethers.io/ethers.js/html/api-providers.html).
- In order to send transactions we need a [Wallet](https://docs.ethers.io/ethers.js/html/api-wallet.html) (with a private key) or a [Signer](https://docs.ethers.io/ethers.js/html/api-wallet.html#signer-api) (like Metamask) to sign them.

### File API

To upload a file and pin it on IPFS, you need the data as a `String` or o as a `UInt8Array` and a signer. Gateways will probably not let you upload arbitrary data unless you are authorised to do so.

```javascript

const { FileApi, Gateway } = require("dvote-js")
const { Wallet } = require("ethers")

const MNEMONIC = "..."
const PATH = "m/44'/60'/0'/0/0"
const GATEWAY_DVOTE_URI = "wss://host:port/dvote"
const GATEWAY_PUB_KEY = "02..."
const NETWORK_ID = ""

const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

gateway = await Gateway.fromInfo({ uri: GATEWAY_DVOTE_URI, supportedApis: ["file"], publicKey: GATEWAY_PUB_KEY })
await gateway.init()

// alternatively for a pool of gateways
// const options = {
//         networkId: "goerli",
//         bootnodesContentUri: GATEWAY_DVOTE_URI,
//         numberOfGateways: 2,
//         race: false,
//         timeout: 10000,
//     }
// gateway = await pool.discover(options)


// Wallet to sign requests
const wallet = Wallet.fromMnemonic(MNEMONIC)
console.log("SIGNING FROM ADDRESS", wallet.address)

// Upload the file
const strData = "HELLO WORLD"
const origin = await FileApi.add(Buffer.from(strData), "my-file.txt", wallet, dvoteGw)
console.log("DATA STORED ON:", origin)

// Read the contents back as a string
const data = await FileApi.fetchString(origin, dvoteGw)
console.log("DATA:", data)

// Read the contents back as a byte array
const data = await FileApi.fetchBytes(origin, dvoteGw)
console.log("DATA:", data)
```

### Entity

#### Register or update an Entity:

```javascript
const { EntityApi, Gateway } = require("dvote-js")
const { Wallet, providers } = require("ethers")

const MNEMONIC = "..."

// Use a random GW from Vocdoni at "goerli" network
const gw = await Gateway.randomFromDefault("goerli")
await gw.init()

const provider = gw.provider
const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)

// Attach to the Entity Resolver contract
const resolverInstance = await gw.getEnsPublicResolverInstance(wallet)

const myEntityAddress = await wallet.getAddress()
const jsonMetadata = { ... } // EDIT THIS

// Request the update
const contentUri = await EntityApi.setMetadata(myEntityAddress, jsonMetadata, wallet, gw)

console.log("IPFS ORIGIN:", contentUri)
```

#### Fetch the metadata of an Entity:

```javascript
const { EntityApi, Gateway } = require("dvote-js")
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
const gateway = await Gateway.fromInfo(gwInfo)
await gateway.init()

const meta = await EntityApi.getMetadata(myEntityAddress, gateway)
console.log("JSON METADATA", meta)
```

#### Set ENS text records

```javascript
const { Gateway, ensHashAddress } = require("dvote-js")
const { Wallet, providers } = require("ethers")

const GATEWAY_WEB3_PROVIDER_URI = "https://rpc.slock.it/goerli"
const MNEMONIC = "..."

const wallet = Wallet.fromMnemonic(MNEMONIC, PATH)
const gwInfo = new GatewayInfo(GATEWAY_DVOTE_URI, GATEWAY_SUPPORTED_APIS, GATEWAY_WEB3_PROVIDER_URI, GATEWAY_PUBLIC_KEY)
const gateway = await Gateway.fromInfo(gwInfo)

// Attach to the Entity Resolver contract
const resolverInstance = await gateway.getEnsPublicResolverInstance({ provider, wallet })
await gateway.init()

const myEntityAddress = await wallet.getAddress()
const entityNode = ensHashAddress(myEntityAddress)

// Set an ENS Text record
const tx = await contractInstance.setText(entityNode, "my-key", "1234")
await tx.wait()

// Read the value
const val = await contractInstance.text(entityNode, "my-key")
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
const { WalletUtil } = require("dvote-js")
const mnemonic = "my mnemonic ..."
const mnemonicPath = "m/44'/60'/0'/0/0"
const provider = ethers.getDefaultProvider('goerli')

const wallet = WalletUtil.fromMnemonic(mnemonic, mnemonicPath, provider)
wallet.sendTransaction(...)
// ...
```

Generating a standalone deterministic wallet from a passphrase and a (non-private) seed. They are intended to provide wallets where the private key can be accessed.

```typescript
const { Random, WalletUtil } = require("dvote-js")
const provider = ethers.getDefaultProvider('goerli')

// Created from scratch
const hexSeed = Random.getHex()  // could be stored locally
const passphrase = "A very Difficult 1234 passphrase" // must be private and include upper/lowercase chars and numbers

// Or using an already created seed
const hexSeed = "0xfdbc446f9f3ea732d23c7bcd10c784d041887d48ebc392c4ff51882ae569ca15"
const passphrase = "A very Difficult 1234 passphrase" // must be private and include upper/lowercase chars and numbers

const wallet = WalletUtil.fromSeededPassphrase(passphrase, hexSeed, provider)
wallet.signMessage(...)
// ...
```

Accessing the browser wallet or MetaMask:

```typescript
const { SignerUtil } = require("dvote-js")
const signer = SignerUtil.fromInjectedWeb3()
signer.sendTransaction(...)
```

## Components

### Entity

The entity API allows updating and querying the key-value fields of the Entity Resolver contract. On top of the key-value storage, lies a link to the entity's metadata, which is the human readable information about it.

### Process

Resembling the likes of a Unix process, a Vocdoni process contains a set of flags defining how an L2 governance process is conducted on the Vochain.

In addition to the flags is the process metadata, which is the human readable content that voters will be prompted for making a choice.

### Gateway

Provides utility functions to fetch data from decentralized filesystems, sending messages and adding files to IPFS.

## Example

For more involved examples, check out:

- `example/index.js` for examples about specific components
- `example/standard/index.js` for an end to end standard process
- `example/bridge/index.js` for an end to end process using an ERC20 based census
- `example/ethers/index.js` for general usage tips about Ethers.js Wallets and Providers

## Development

Simply run `npm run test`. It is an alias for `npm run test:unit` and `npm run test:integration`.

- Unit testing will start an internal Ganache provider and launch transactions to it
- Integration testing is still a WIP

### Builders

In order to avoid tedious and repetitive testing code, you can check out the `test/builders` folder. Entity and Process builders deploy a new instance and create an Entity/Process with default values. These default values can be overridden with one-liners, if needed:

```javascript
const EntityResolverBuilder = require("./test/builders/entity-resolver")
const ProcessBuilder = require("./test/builders/process")

const contractInstance1 = await new EntityResolverBuilder().build()
const contractInstance2 = await new ProcessBuilder().build()

const contractInstance3 = await new EntityResolverBuilder()
    .withName("Another name")
    .build()

const contractInstance4 = await new ProcessBuilder()
    .withVotingPublicKey("...")
    .build(3)  // create 3 voting processess within the new contract

```

Note: This is still under heavy development.

### Mocha

When adding new test suites, don't forget to add a call to `addCompletionHooks()`. Otherwise, the NodeJS process will keep up indefinitely when testing.

### Simulating future timestamps

If you need a transaction to happen in a future timestamp, use `test/utils > incrementTimestamp()` instead of forcing your code to wait.

Be aware that from this point, if you use `Date.now()` on the Javascript side, values will not match the timestamp of the blockchain. So make sure to call `getBlockNumber()` and `getBlock(<num>) > timestamp`.

### Testing accounts

Use `test/web3-service > DevWeb3Service > accounts` to retrieve a list of 10 funded accounts with the following data schema:

```javascript
{
    privateKey: "...",
    address: "0x...",
    provider: <ethers-js-provider>,
    wallet: <ethers-js-wallet>
}
```

These accounts are connected to an in-memory Ganache RPC node.
