# DVote JS changelog

## 0.16.0

- Deep refactor to support the new Process contract methods
    - Adding `setStatus`, `incrementQuestionIndex`, `setCensus` and `setResults`
    - Exposing `ProcessMode`, `ProcessEnvelopeType`, `ProcessStatus` and `ProcessContractParameters` from DVote Solidity
    - Updating the process metadata to feature `mode` and `envelopeType`. Deprecate `type`.
    - Remove the type from the old Vote Package
    - Adding `deployNamespaceContract` and `getNamespaceInstance`
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
- Borrowing builders to test the contract method integration
- Revamped tests