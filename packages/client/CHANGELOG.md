# @vocdoni/client - Changelog

## 1.16.6

- Updated GWs methods: `getEntityCount`, `getProcessCount` and `sendContactMsg`

## 1.16.5

- Added archive support for process listing

## 1.16.4

- Adding support for Polygon mainnet and testnet networks

## 1.16.3

- `GatewayArchive` improvements adding `startDate` and `endDate`

## 1.16.2

- Preventing an empty timeout value to be passed

## 1.16.1

- Adding a check to prevent empty networks from causing an unhandled error

## 1.16.0

- Adding support to fetch the chainId
- Using salted JSON signatures
- Adding `dvoteGateway.getVocdoniChainId()`
- BREAKING:
  - `web3Gateway.networkId` is now `web3Gateway.getEthNetworkId()`
  - `web3Gateway.chainId` is now `web3Gateway.getEthChainId()`
  - `dvoteGateway.getInfo()` is now `dvoteGateway.getVocdoniInfo()`
- `getVocdoniInfo` now returns the `chainId`

## 1.15.1

- Adding support for Avax and Fuji networks

## 1.15.0

- Supporting anonymous voting (registerVoterKey added)
- Allowing to verify content hashed URI's

## 1.14.2

- Adding `Erc20TokensApi.isRegistered`, `Erc20TokensApi.getTokenAddressAt` and
  `Erc20TokensApi.getTokenCount`

## 1.14.1

- Improved readme

## 1.14.0

- First version of the package, starting from dvote-js version 1.13.2
