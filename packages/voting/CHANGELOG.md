# @vocdoni/voting - Changelog

## 1.14.0

- First version of the package, starting from dvote-js version 1.13.2
- Breaking change on `VotingOracleApi.newProcessErc20()`
  - Now expecting `tokenDetails` as a parameter
  - See `VotingOracleApi.newProcessErc20` comment in `packages > voting > src > voting.ts`
- Moving `registerVoterKey` to `CensusOnChainApi.registerVoterKey` (`@vocdoni/census`)
