# @vocdoni/census - Changelog

## 1.15.0

- Adding support for Anonymous voting (zkSnarks)
  - `CensusOnChainApi.registerVoterKey`, `CensusOnChainApi.generateProof`
- Breaking: all census keys are assumed to be undigested

## 1.14.1

- Moving `registerVoterKey` to `CensusOnChainApi.registerVoterKey`
- Dependency bump

## 1.14.0

- First version of the package, starting from dvote-js version 1.13.2
- Renaming `CensusCaApi` to `CensusBlind`
