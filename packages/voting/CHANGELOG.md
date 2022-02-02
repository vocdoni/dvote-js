# @vocdoni/voting - Changelog

## 1.16.2

- Fixed archive results not depending on encryption keys and `GatewayArchive` improvements adding `startDate` and `endDate`

## 1.16.1

- Amending the type of signature applied

## 1.16.0

- Using salted signatures

## 1.15.5

- Added `getAnonymousHexNullifier` for calculating the anonymous hexadecimal nullifier

## 1.15.4

- Adding missing flags in `ProcessState`

## 1.15.3

- Fixing the double source of truth problem with the process status

## 1.15.2

- Removing the unneeded `walletOrSigner` parameter from `packageSignedEnvelope`

## 1.15.1
## 1.15.0

- Allowing to compute ZK Proofs for anonymous voting
- Splitting remote/local methods into `VotingApi.xxx` and `Voting.xxx`

## 1.14.0

- First version of the package, starting from dvote-js version 1.13.2
- Breaking change on `VotingOracleApi.newProcessErc20()`
  - Now expecting `tokenDetails` as a parameter
  - See `VotingOracleApi.newProcessErc20` comment in `packages > voting > src > voting.ts`
- Moving `registerVoterKey` to `CensusOnChainApi.registerVoterKey` (`@vocdoni/census`)
