# DVote JS
Formerly known as dvote-client, this library aims to provide utility classes and methods to invoke decentralized operations within a voting process. It covers the typical functionality of Client applications, as well as the Process Manager or the Census Manager.

The intended functionality is to interact with a public Ethereum blockchain, to fetch data from a decentralized filesystem, to enforce data schema validity, to prepare vote packages and using decentralized messaging networks through Gateways or Relays.

## Getting started

The library is built on top of [Ethers.js](https://docs.ethers.io/ethers.js/html/), which is fully compatible with Web3.

```sh
npm install ethers
```

To interact with the blockchain, we need a [Provider](https://docs.ethers.io/ethers.js/html/api-providers.html). In order to send transaction we need a [Wallet](https://docs.ethers.io/ethers.js/html/api-wallet.html) to sign them as well. 

### Blockchain read-only interactions

Start by defining a provider:

```javascript
const ethers = require("ethers")   // NodeJS
import { ethers } from "ethers"    // ES6 Browser

// standard
const provider = ethers.getDefaultProvider('homestead') // mainnet

// other alternatives
const altProvider = new ethers.providers.EtherscanProvider('ropsten')

// using custom ones
const currentProvider1 = new web3.providers.HttpProvider('http://localhost:8545')
const web3Provider1 = new ethers.providers.Web3Provider(currentProvider1)

const currentProvider2 = new web3.providers.JsonRpcProvider('http://localhost:8545')
const web3Provider2 = new ethers.providers.Web3Provider(currentProvider2)
```

[More information](https://docs.ethers.io/ethers.js/html/api-providers.html#connecting-to-ethereum)

Next, initialize a **contract factory** and use it to attach to an instance.

```javascript
const { EntityResolver } = require("dvote-js")

// using an explicit provider like the above
const EntityResolverFactory = new EntityResolver({ provider })
// or using a URL
const EntityResolverFactory2 = new EntityResolver({ providerUrl: "http://localhost:8545" })

// attaching to an existing contract instance
const resolverContractAddress = "0x0123456789012345678901234567890123456789"
const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

// calling data from the blockchain
const entityId = EntityResolver.getEntityId(myEntityAddress)
const value = await resolverInstance.text(entityId, "key-name")
console.log("value=", value)

```

### Blockchain transcations

To send signed transactions to the blockchain, you need a funded account.

DVoteJS uses an [Ethers.js wallet](https://docs.ethers.io/ethers.js/html/api-wallet.html) internally. You can simply attach to MetaMask/Mist/Parity when available and you can also provide your private key or a mnemonic on local environments (NodeJS).

[More information](https://docs.ethers.io/ethers.js/html/api-wallet.html)

#### MetaMask, Mist or Parity

On a Web3 enabled browsers, the provider can be simply borrowed from `window.web3.currentProvider`. The wallet is automatically available. 

```javascript
import ethers from "ethers"
import { EntityResolver } from "dvote-js"

const myProvider = new ethers.providers.Web3Provider(web3.currentProvider)

const EntityResolverFactory = new EntityResolver({ web3Provider: myProvider })

// By passing 'web3Provider', DVoteJS will automatically attach to the 
// signing mechanisms provided by MetaMask, Mist or Parity

```

#### NodeJS or local environments

Otherwise, you need to provide a private key or a mnemonic seed phrase (with an optional derivation path).

```javascript
const { EntityResolver } = require("dvote-js")

// using a private key
const EntityResolverFactory = new EntityResolver({ provider, privateKey: "...." })
// using a mnemonic (mnemonicPath is optional)
const EntityResolverFactory = new EntityResolver({ provider, mnemonic: "...", mnemonicPath: "m/44'/60'/0'/0/3" })

```

#### Sending actual transactions

Now, in both cases you have connected contract factories that can attach to any contract and eventually send signed transcations.

```javascript
// ...

const myWallet = EntityResolverFactory.wallet
const myEntityAddress = await myWallet.getAddress()
const entityId = EntityResolver.getEntityId(myEntityAddress) // used to query the Entity resolver

// deploying a contract
const resolverInstance = await EntityResolverFactory.deploy()

// sending a transaction
const tx = await resolverInstance.setText(entityId, "another-key-name", "My official entity")
await tx.wait()

// calling the new data from the blockchain
const value = await resolverInstance.text(entityId, "another-key-name")
console.log("value=", value)

```

## Example usage


```javascript
const { EntityResolver, VotingProcess } = require("dvote-js")

// using an explicit provider like the above
const EntityResolverFactory = new EntityResolver({ provider })
// or using a URL
const VotingProcessFactory = new VotingProcess({ providerUrl: "http://localhost:8545" })

// attaching to an existing contract instance
const resolverContractAddress = "0x0123456789012345678901234567890123456789"
const resolverInstance = EntityResolverFactory.attach(resolverContractAddress)

// calling data from the blockchain
const entityId = EntityResolver.getEntityId(myEntityAddress)
const value = await resolverInstance.text(entityId, "key-name")
console.log("value=", value)

// attaching to another instance
const votingProcessAddress = "0x1234567890123456789012345678901234567890"
const votingProcessInstance = VotingProcessFactory.attach(vProcessAddress)

// calling more data
const processNumber = 10  // incremental counter
const pocessId = VotingProcess.getProcessId(entityId, processNumber)
const processData = await votingProcessInstance.get(processId)

const {
    entityResolver, 
    entityAddress, 
    processName, 
    metadataContentUri, 
    startTime, 
    endTime,
    voteEncryptionPublicKey, 
    canceled
} = processData 

console.log("Voting process name:", processName)

```

Full API details coming soon. You can have a look at `test/unit/entity-resolver` and `test/unit/voting-process` meanwhile.


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

If you need a transaction to happen in a future timestamp, use `test/eth-utils > increaseTimestamp()` instead of forcing the code to wait. 

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

<!--
### Census

A custom made service, intended to provide the tools to join a census, get a census proof, etc.

Operations like `getMetadata(processId)` need the class to be initialized with `instance.initBlockchain(web3.currentProvider, votingProcessContractAddress)`. (Note this may change soon)

The rest of operations rely on `instance.initCensusService(censusURL)`

## Development
We are using tslint, please install it in your IDE. If using Visual Studio Code: https://marketplace.visualstudio.com/items?itemName=eg2.tslint

## Testing

Run a local Ethereum node like Ganache (with a funded account):

```
npm i -g ganache-cli
ganache-cli -m "universe link ..."
```

Run a census service on your local computer:

```
git clone https://github.com/vocdoni/go-dvote.git
cd cmd/censushttp
go run censushttp.go 1500 testcensus    # accept any signature
go run censushttp.go 1500 testcensus:<PUBLIC_KEY>
```

Then in another tab:

```
npm install
npm test
```

## Building the JS library
`npm install && npm run build`

-->
