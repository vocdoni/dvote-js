[![Build Status](https://travis-ci.com/vocdoni/dvote-client.svg?branch=master)](https://travis-ci.com/vocdoni/dvote-client)

# DVote Client
Typescript client library to work with the Vocdoni core features.

## Components

The library provides convenience classes and methods to access the various components of a DVote process.

### Entity

Any Ethereum account can create an Entity, which may create voting processes.

### Process

A voting process.

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
go run censushttp.go 1500 <PUBLIC_KEY>
```

Then in another tab:

```
npm install
npm test
```

## Building the JS library
`npm install && npm run build`

## Breaking changes

* Version `0.0.22`
    * The `snapshot()` method of `Census` has been removed. Use `getRoot()` and `dump()` instead
    * The `dump()` method of `Census` now requires a second parameter with the private key to sign (this may change very soon)
    * Test suites are now invoked like `npm run test`, `npm run test:unit`, `npm run test:integration` and `npm run test:remote` 
