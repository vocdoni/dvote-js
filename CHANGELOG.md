# DVote JS changelog

## 0.19.0

- Upgrading dvote-solidity to `v0.13.0`
- Adapting the census enum
    - Renaming `OFF_CHAIN` into `OFF_CHAIN_TREE`
    - Adding `OFF_CHAIN_TREE_WEIGHTED` ad `OFF_CHAIN_CA`
- Updating the Census API to support weighted censuses
    - `addClaim`, `addClaimBulk`, `dump` and `dumpPlain` now receive/return a `{ key: string, value?: string }[]` instead of a `string[]`

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
