# DVote JS changelog

## 0.24.1

- Updating the domain name suffix on the environment constants

## 0.24.0

- Updating the clients to request the Vocdoni environment to use (`prod`, `stg`, `dev`)
    - This will use the relevant ENS domains (`xxx.vocdoni.eth`, `xxx.stg.vocdoni.eth`, `xxx.dev.vocdoni.eth`)
- Affected calls:
    - `GatewayPool.discover`
    - `GatewayBootnode.getDefaultGateways`
    - `GatewayBootnode.getDefaultUri`
    - `GatewayBootnode.digest`
    - `GatewayBootnode.digestNetwork`
    - `Web3Gateway` constructor
    - `Gateway.randomFromDefault`
    - `Gateway.randomfromUri`
    - `Gateway.fromInfo`

## 0.23.0

- Adding `CensusCaApi` to allow working with blind signatures
- Adding a complete example flow

## 0.22.0

- Avoiding the `/ping` check on initialization

## 0.21.4

- Exporting `CaBundleProtobuf`

## 0.21.3

- Adding support for CA voting on `packageSignedEnvelope`

## 0.21.2

- Updating `getProcessList` so that `Key not found` returns an empty list instead of an error

## 0.21.1

- Allowing arbitrary `meta` fields within the Process metadata

## 0.21.0

- Gateway API methods have been refactored to accomodate the Registry API
    - `ApiName` and `ApiMethod` are available
    - `GatewayApiName` and `GatewayApiMethod` are available
    - `BackendApiName` and `BackendApiMethod` are available
    - Renamed types and enum's
        - `getGatewayInfo` is now `getInfo`
        - `DVoteGatewayMethod` is now `GatewayApiMethod`
        - `dvoteGatewayApiMethods` is now `gatewayApiMethods`
        - New enum `backendApiMethods` (registry)
        - `dvoteApis` is now `clientApis` (gateway and registry)
            - `gatewayApis` and `backendApis` are also available
        - `IDvoteRequestParameters` is now `IRequestParameters`
- **Breaking:** Using compressed keys everywhere (existing censuses won't work)
    - Adding `compressPublicKey` and `expandPublicKey`
    - `digestHexClaim` is now `digestPublicKey`
    - `digestPublicKey` compresses all keys

## 0.20.3

- Using INewProcessParams in newProcess

## 0.20.2

- Ensuring that all imports use relative paths

## 0.20.1

- Fixing a bug in `packageSignedEnvelope`

## 0.20.0

- `getRawResults` now returns an array containing numbers as strings, to account for big numbers
- `getResultsDigest` now returns numeric values as `BigNumbers`

## 0.19.0

- Upgrading dvote-solidity to `v0.13.0`
- Adapting the census enum
    - Renaming `OFF_CHAIN` into `OFF_CHAIN_TREE`
    - Adding `OFF_CHAIN_TREE_WEIGHTED` ad `OFF_CHAIN_CA`
- Updating the Census API to support weighted censuses
    - `addClaim`, `addClaimBulk`, `dump`, `dumpPlain` and `generateProof` now receive/return a `{ key: string, value?: string }[]` instead of a `string[]`
    - These methods also return `censusRoot` and `censusUri` (where applicable) instead of `merkleRoot` and `merkleTreeUri`

## 0.18.1

- Connecting contracts to the pool provider only when a Wallet is passed

## 0.18.0

- Adding support for ERC20 census based processes

## 0.17.2

- Renamed `CensusApi` to `CensusOffChainApi`
- Renamed `CensusEthApi` to `CensusErc20Api`

## 0.17.1

- `submitEnvelope` now accepts a `Uint8Array` as the envelope

## 0.17.0

**Major breaking changes**

- Deep refactor to support the new Process contract methods
    - Adding `setStatus`, `incrementQuestionIndex`, `setCensus` and `setResults`
    - Exposing `ProcessMode`, `ProcessEnvelopeType`, `ProcessStatus` and `ProcessContractParameters` from DVote Solidity
    - Updating the process metadata to feature `mode` and `envelopeType`. Deprecate `type`.
    - Added Namespace contract method functions
    - Remove the type from the old Vote Package
    - Adding `getNamespaceInstance`
- Improving the naming consistence (Vote API and Process-related methods)
    - Turning the `entityId` into `entityAddress` (no longer a hash)
    - Renaming `create` into `newProcess`, along with new parameters
    - Renaming `packageSnarkEnvelope` into `packageAnonymousEnvelope`
    - Renaming `packagePollEnvelope` into `packageSignedEnvelope`
    - Renaming `numberOfVotes` into `blockCount`
    - Renaming `getVoteMetadata` into `getProcessMetadata`
    - Renaming `cancel` into `setStatus`
    - Replacing `getEntityId` by `ensHashAddress`
    - Merging `packageSnarkVote` and `packagePollVote` into `packageVoteContent`
    - Removing `getEntityMetadataByAddress()`
    - Refactoring `isCanceled` within `getProcessParameters`
    - Removing non-human readable data from `ProcessMetadata` already present on the Smart Contract
    - Renaming `ProcessResultItem.question` to `ProcessResultItem.title`
    - Renaming `ProcessResultItem.questions.options` to `ProcessResultItem.questions.choices`
    - Renaming `setEntityMetadata` into `setMetadata`
    - Renaming `sendMessage` to `sendRequest` for consistency
    - Renaming `getEntityResolverInstance` to `getEnsPublicResolverInstance`
    - Renaming `IEntityResolverContract` to `IEnsPublicResolverContract`
- Borrowing builders to test the contract method integration
- Revamped tests
- Adding Gateway mocks and disposable Ethereum servers for testing
- Census methods now have wallet and gateway parameters swapped, for consistency with the rest of API methods
- API methods arranged by class
    - File API
        - `fetchFileString`, `fetchFileBytes` and `addFile` are now `FileApi.fetchString`, `FileApi.fetchBytes` and `FileApi.add`
    - Entity API
        - `getEntityMetadata` and `setMetadata` are now `EntityApi.getMetadata` and `EntityApi.setMetadata`
    - Voting API
        - All functions are now used like `VotingApi.<func>`
    - Census API
        - All functions are now used like `CensusApi.<func>`
- Added Namespace API
- Added CensusEthApi
- Gateway client refactor
    - Using HTTP-only gateway clients
    - Cleaner Gateway Pool methods
    - Discovery
        - Rearrange `discoverGateways` into `GatewayDiscovery.run`
        - Rename `fetchFromBootNode` into `getGatewaysFromBootnode`
        - Rename `fetchDefaultBootNode` into `getDefaultGateways`
        - Rename `getNetworkGatewaysFromBootNodeData` into `digestBootnodeNetworkData`
        - Rename `getGatewaysFromBootNodeData` into `digestBootnodeData`
    - Bootnode
        - Encapsulating all functions into the `GatewayBootnode` class
            - `getDefaultGateways`, `getDefaultUri`, `getGatewaysFromUri`, `digest`, `digestNetwork`
            - ~~getDefaultBootnodeUri~~, ~~digestBootnodeData~~, ~~digestBootnodeNetworkData~~, ~~getGatewaysFromBootnode~~
        - Rename `GatewayBootNodes` into `JsonBootnodeData` (type)
        - Rename `getDefaultBootnodeContentUri` into `getDefaultBootnodeUri`
        - Rename `NetworkId` into `EthNetworkID`
    - ENS
        - Rename `entityResolverEnsDomain` to `publicResolverEnsDomain`
        - Rename `processEnsDomain` to `processesEnsDomain`
        - Exporting `namespacesEnsDomain` and `storageProofsEnsDomain`
    - Web3
        - Renaming `getProcessInstance` into `getProcessesInstance`
        - Renaming `getNamespaceInstance` into `getNamespacesInstance`
- Utilities
    - Encapsulate the provider helper functions into `ProviderUril`
        - `providerFromUri` and `providerFromBrowserProvider` are now `ProviderUtil.fromUri` and `ProviderUtil.fromInjectedWeb3`
    - Encapsulate the wallet and signer helper functions into `WalletUtil` and `SignerUtil`
        - `walletFromSeededPassphrase`, `walletFromMnemonic` and `signerFromBrowserProvider` are now `WalletUtil.fromSeededPassphrase`, `WalletUtil.fromMnemonic` and `SignerUtil.fromInjectedWeb3`
    - Encapsulate random generators into `Random`
        - `generateRandomHexSeed` is now `Random.getHex()`
        - `Random.shuffle` is now available for arrays
    - Encapsulate signature helpers into `JsonSignature` and `BytesSignature`
        - `signJsonBody`, `isValidSignature`, `recoverSignerPublicKey` and `sortObjectFields` are now `JsonSignature.sign`, `JsonSignature.isValid`, `JsonSignature.recoverPublicKey` and `JsonSignature.sort`
        - `signBytes` and `isByteSignatureValid` are now `BytesSignature.sign` and `BytesSignature.isValid`
    - Encapsulate waiters into `VochainWaiter` and `EthWaiter`
        - `waitVochainBlocks` and `waitUntilVochainBlock` are now `VochainWaiter.wait` and `VochainWaiter.waitUntil`
        - `waitEthBlocks` and `waitUntilEthBlock` are now `EthWaiter.wait` and `EthWaiter.waitUntil`
- Contracts
    - Removing `deployEnsPublicResolverContract`, `deployNamespaceContract`, `deployProcessContract` as the functionality is available on `dvote-solidity`
    - Removing `getEnsPublicResolverInstance`, `getNamespaceInstance`, `getProcessInstance` functions on `net/contracts` as they duplicate the functionality already present in `Gateway`
