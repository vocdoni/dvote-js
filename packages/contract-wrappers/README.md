# @vocdoni/contract-wrappers

@vocdoni/contract-wrappers contains JS wrappers for the solidity contract artifacts from [dvote-solidity library](https://github.com/vocdoni/dvote-solidity/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/contract-wrappers.

```bash
npm install @vocdoni/contract-wrappers
```

## Usage

#### ENS hash address

```ts
import { ensHashAddress } from "@vocdoni/contract-wrappers"

const addr = "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"
ensHashAddress(addr)
// returns '0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e'
```

## Testing

To execute library tests just run

```bash
npm run test
```
