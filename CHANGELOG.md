# DVote JS changelog

- `Census.addClaim`, `Census.addClaimBulk` and `Census.registerVoterKey` now don't receive the `isDigested` parameter.
- `generateProof` now returns the siblings and the weight
- `IProofArbo`, `IProofCA` and `IProofEVM` now require a `weight` bigint

## 1.13.3

- Fix an internal import

## 1.13.2

- Supporting ProofArbo instead of ProofGraviton

## 1.13.1

- Skip padding storage proof values to be compatible with the new backend version

## 1.13.0

- Adding the `censusType` field on `addCensus` defaulting to `ARBO_BLAKE2B`

## 1.12.0

- Supporting multiple choice (single question) results
    - https://docs.vocdoni.io/architecture/data-schemes/ballot-protocol.html#vocdoni-results-interpretation
- BREAKING:
    - `VotingApi.getRawResults` no longer exists
        - Use `VotingApi.getResults()` instead
    - `VotingApi.getResultsDigest()` no longer exists. 
    - Arrange results with:
        - `Voting.digestSingleChoiceResults(results, metadata)`
        - `Voting.digestSingleQuestionResults(results, metadata)`
    - Types `DigestedProcessResults` and `DigestedProcessResultItem` no longer exist
        - Use `ProcessResultsSingleChoice`, `ProcessResultsSingleQuestion` instead

## 1.11.4

- Retrieving light storage proofs for ERC20 tokens instead of full block ones

## 1.11.3

- Upgrade the storage-proofs dependency
- Adding the Baby Jub Jub wallet back (ffjavascript)

## 1.11.2

- Corrects XDAI and XDAI_STG entityID constants

## 1.11.1

- Workaround: Back off the tricky exports from ffjavascript (ES incompatible by default)

## 1.11.0

- Adding `VotingApi.registerVotingKey`
- Implementing `Voting.packageAnonymousEnvelope`
- Adding `Voting.getAnonymousVoteNullifier()`
- Renamed TS types
    - `ISourceNetworkId` is now `SourceNetworkId`
    - `IProcessDetails` is now `ProcessDetails`
    - `IProcessState` is now `ProcessState`
    - `IProcessSummary` is now `ProcessSummary`
    - `IProcessKeys` is now `ProcessKeys`
    - `IVotePackage` is now `VotePackage`
- Added archive support as a fallback in `VotingApi` for `getProcess`, `getProcessState`, `getProcessSummary`, `getResultsWeight`, `getEnvelopeHeight` and `getRawResults` when the process has expired on the Vochain
- Supporting the `getStats` and `getBlockList` gateway methods
- [Breaking]
    - `VotingApi.getProcessId`,  `VotingApi.packageAnonymousEnvelope`, `VotingApi.packageVoteContent`, `VotingApi.packageSignedProof` and `VotingApi.getSignedVoteNullifier` are moved from `VotingApi` to the `Voting` namespace
- Adding the `IGatewayClient`, `IGatewayDVoteClient` and `IGatewayWeb3Client` interfaces, so that methods don't depend on explicit class types
- Internal arrangements for clarity and flexibility

## 1.10.1
- Addressing a problem that could prevent signing binary payloads on Chrome-based browsers

## 1.10.0

Breaking changes to support ZK Snarks and Baby JubJub wallets

- [Breaking] Using a new version of the Poseidon hash algorithm (now working with bigInt's)
- [Breaking] Refactoring `hashing.ts`
    - Removing `hashBuffer`, `multiHash` and `hash` from `hashing.ts`
    - Adding `Keccak256.hashText`, `Keccak256.hashHexString`, `Keccak256.hashBytes`
    - Adding `Poseidon.hash`, `Poseidon.hashBabyJubJubPublicKey`, `Poseidon.getNullifier`
- Adding `CensusOffChain`
    - Adding `CensusOffChain.Public` (`encodePublicKey`) and `CensusOffChain.Anonymous` (`digestPublicKey`)
    - `CensusOffChainApi.digestPublicKey` is gone
        - Replace `CensusOffChainApi.digestPublicKey(..., CensusOffchainDigestType.RAW_PUBKEY)` by `CensusOffChain.Public.encodePublicKey` instead
    - `CensusOffchainDigestType` is no longer needed
    - [Breaking] `generateCensusId` and `generateCensusIdSuffix` are now part of `CensusOffChain`
- Adding the `WalletBabyJubJub` class
- [Breaking] `CensusOffchainApi.getCensusSize` is now `CensusOffchainApi.getSize`
- [Breaking] `SignerUtil.fromInjectedWeb3` is now `Web3Signer.fromInjected`
- Adding `Random.getRandomBytes` and `Random.getBigInt`
- `generateCensusIdSuffix` now uses keccak256 internally
- Converting class groupings into `namespaces`
- Using `personal_sign` when signing payloads via a JSON RPC call.
    - Prevents signature mismatches when using Wallet Connect, Ledger, Trezor, etc through `useWallet`

## 1.9.14
## 1.9.13
- Fixing a relative path that was causing issues with yarn

## 1.9.12
- Upgrades the Ethereum Storage proofs dependency to account for the London hard for

## 1.9.11
- Reestablishes weight and random factor for gateway discovery (dvote and web3)
- Changes ethers provider from `JsonRpcProvider` to `StaticJsonRpcProvider` in order to avoid unecessarry `eth_chainId` calls

## 1.9.10

- Improved and ligther Gateway Discovery process
- Better handling of requests and responses
- Changes to `IGatewayDiscoveryParameters`
  - Change from `type` to `interface`
  - New attribute `resolveEnsDomains` for resolving the ENS Domains in the discovery process

## 1.9.9

- Changes to `IProcessState`
  - Establishes use of `VochainProcessStatus` instead of `IProcessStatus` since the state data are received only from vochain
  - Removes `IProcessVochainStatus` type in favour of `VochainProcessStatus` and uses the enum reverse mapping to handle strings
  - Converts `censusOrigin`  to `VochainCensusOrigin` since it is a superset of `IProcessCensusOrigin`
- Redefines `IProcessSummary` reusing fields from the existing `IProcessState`
  - Converts `blockCount` of `IProcessSummary` to `endBlock` for consistency with `IProcessState`

## 1.9.8

- Minor bug fix

## 1.9.7

- Adds support for XDAI `stg` environment introducing the corresponding registry address
- Adds XDAI gasPrice estimation before sending     transactions with a default of 60Gwei

## 1.9.6

- FileApi catching GW pool shift errors

## 1.9.5

- Supporting fetchFile GW responses to shift pool nodes

## 1.9.4

- Simplifying `IProcessDetails` avoiding a redundant field (`entityId`)

## 1.9.3

- Stop retrying failed operations on gateway pool clients after a certain count
- Lighter and faster attempt to fetch files from well-known IPFS gateways

## 1.9.2

- Getting the metadata URI from Ethereum if the GW doesn't have it (results)

## 1.9.1

- Getting the metadata URI from Ethereum if the GW doesn't have it

## 1.9.0

- BREAKING:
    - `IProcessInfo` is now `IProcessDetails` to avoid confusions with similar Vochain calls
        - `IProcessInfo.parameters` is now `IProcessDetails.state`
        - `IProcessInfo.entity` is now `IProcessDetails.entityId`
    - `IProcessHeaders` is now `IProcessSummary`
    - `IProcessVochainParameters` is now `IProcessState`
    - `getProcessHeaders` is now `getProcessSummary`
    - `getProcessInfo` is now `getProcessState`
- Adding `IProcessVochainStatus` and `ISourceNetworkId` types

## 1.8.4

- (Backport) Getting the metadata URI from Ethereum if the GW doesn't have it

## 1.8.3

- Relaxing the gateway prototype checks

## 1.8.1

- Increases XDAI gasprices to 30gwei

## 1.8.0

- BREAKING: `getProcessInfo` now returns `parameters` of type `IProcessVochainParameters`
- Adding `getProcessHeaders`

## 1.7.0

- Adding signaling voting via `VotingOracleApi`

## 1.6.0

- Provides a new set of recovery questions for wallets (dvote-protobuf)

## 1.5.6

- Implements `getProcessInfo` for the `VotingApi`

## 1.5.5

- Improved string normalization, ignoring diacritics and confusing symbols

## 1.5.4

- Reusing the `initEns` existing flow to save connections

## 1.5.3

- Adding `getProcess` to allow for more efficient queries on the frontend

## 1.5.2

- Minor change to support frontend React renders

## 1.5.1

- Allowing to estimate dates and blocks synchronously

## 1.5.0

- Allowing to provide an already fetched block status on `estimateBlockAtDateTime` and `estimateDateAtBlock`

## 1.4.0

- Adding `AccountBackup` to allow exporting and recovering backup credentials protected by recovery questions

## 1.3.2

Update dvote-solidity to 1.3.1

## 1.3.1

- Adding the well-known Mainnet entity address for Vocdoni (to provide a default bootnode)

## 1.3.0

- Adding `CensusErc20Api.registerTokenAuto` and `CensusErc20Api.findBalanceMappingPosition` to allow registering tokens with an unknown balances position
- Using `voc.eth` as the base ENS domain

## 1.2.1
- Modifies `getRawResults` to return the provided `envelopeHeight`
- Adds `totalVotes` number attribute to `DigestedProcessResults`

## 1.2.0
- Fixing a mismatch between entity address and ENS address hash
- `digestPublicKey` now supports different digest types (raw and poseidon)
- Updates `dvote-solidity` to 1.1.0
- Replaces `getBalanceMappingPosition` with `getTokenInfo`
- `evmBlockHeight` now is `sourceBlockHeight`
- Updates newProcess wrappers

## 1.1.6

- Decouples dvote and web3 gateways selection and uses new web3 metrics to prioritize web3 gateways
- Makes net_peercount value not obligatory for web3 gateways
## 1.1.5

- Adding support for Rinkeby

## 1.1.4

- Updates to latest protobuf version with new models for Wallet, Account, Backup
- Changes serializeBackupLink to serializeWalletBackup and deserializeBackupLink to deserializWalletBackup

## 1.1.3
## 1.1.2
## 1.1.1

- Fix an issue with `VotingApi.getResultsWeight`
- Make it expect string values

## 1.1.0

- Adding `VotingApi.getResultsWeight`

## 1.0.4

- Exposing missing encryption utils

## 1.0.3

- Exporting the backup helper functions

## 1.0.2

- Adding `BackupLink` wrappers for the protobuf model

## 1.0.1

- Removing unused types (`IAnonymousVoteEnvelope` and `ISignedVoteEnvelope`)

## 1.0.0

- Bumping to version 1!

## 0.26.2

- Adding `Erc20TokensApi.getTokenList` to list all the available tokens on the contract

## 0.26.1

- Adding support for payable processes

## 0.26.0

- Adding secretbox symmetric encrpytion
- Adding results interpretation fields to the process metadata
- `getProcessList` now uses a `filter` parameter, allowing to specify:
    - `entityId`
    - `namespace`
    - `status` (0-4)
    - `withResults`
    - `from` a number indicating the starting index, rather than an ID
- Removing GW methods: `getProcListResults` and `getProcListLiveResults`
- Renaming GW methods: `getScrutinizerEntities` into `getEntityList`
- Expand the `ProcessMetadata` to allow defining how `results` are aggregated and displayed
- `submitEnvelope`
    - Now expects a protobuf `VoteEnvelope` object as returned by `VotingApi.packageSignedEnvelope`
    - Now expects a wallet/signer instead of the signature
- `packageSignedEnvelope` now returns a vote envelope object only (protobuf)
- Protobuf interfaces are exported directly

## 0.25.4

- Fixes false-positive in supportsMethod
- Implements getCensusList for the CensusOffChainpi

## 0.25.3

- Upgrading vote-solidity

## 0.25.2

- Adding randomness to the gateway selection

## 0.25.1

- Upgrading blindsecp256k1

## 0.25.0

- Using `TextDecoder` for all binary signature checking

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
