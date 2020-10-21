# DVote JS changelog

## 0.16.0

- Deep refactor to support the new Process contract methods
    - Renaming `create` into `newProcess`, along with new parameters
    - Adding `setStatus`, `incrementQuestionIndex`, `setCensus` and `setResults`
    - Exposing `ProcessMode`, `ProcessEnvelopeType`, `ProcessStatus` and `ProcessContractParameters` from DVote Solidity
    - Updating the process metadata to feature `mode` and `envelopeType`. Deprecate `type`.
    - Remove the type from the old Vote Package
    - Rename `packageSnarkEnvelope` into `packageAnonymousEnvelope`, `packagePollEnvelope` into `packageSignedEnvelope`
    - Merged `packageSnarkVote` and `packagePollVote` into `packageVoteContent`
    - Improving the naming consistence (Vote API and Process-related methods)
    - Borrowing builders to test the contract method integration
