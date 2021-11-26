# @vocdoni/client

@vocdoni/client contains shared helpers, models and type definitions for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/client.

```bash
npm install @vocdoni/client
```

## Usage

### Gateway discovery

```ts
import { GatewayDiscovery } from "@vocdoni/client"

const gateways = await GatewayDiscovery.run()
```

You can use any of the gateway objects to send requests to the Voting and Census service providers.

### Eth Provider

```ts
import { ProviderUtil } from "@vocdoni/client"

const provider1 = ProviderUtil.fromUri
  "https://my-web3-endpoint/rpc",
  "mainnet",  // "homestead" | "mainnet" | "rinkeby" | "goerli" | "xdai" | "sokol"
  "prod"  // "prod" | "stg" | "dev"
)

// In a web browser
const provider2 = ProviderUtil.fromInjectedWeb3()
```

### File API

```ts
import { FileApi } from "@vocdoni/client"

const buffData = Buffer.from("hello world")
const result1 = await FileApi.add(buffData, "my-file.txt", myWallet, gw)
// result1 => "ipfs://12346789..."
```

### ENS

```ts
import { getEnsTextRecord } from "@vocdoni/client"

const value = await getEnsTextRecord(gateway, "vnd.vocdoni.meta", { environment: "prod", networkId: "mainnet" })
// result1 => "ipfs://12346789..."
```

## Testing

To execute library tests just run

```bash
npm run test
```
