# @vocdoni/census

@vocdoni/census contains census helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/census.

```bash
npm install @vocdoni/census
```

## Usage

### Merkle proofs (off-chain)

```ts
import { CensusOffChainApi, CensusOffChain } from "@vocdoni/census"
import { computePublicKey } from "@ethrsproject/signing-key"
import { ProviderUtil } from "@vocdoni/client"
import { Random } from "@vocdoni/common"
const { encodePublicKey } = CensusOffChain.Public

const censusIdSuffix = Random.getHex().slice(2)
const managerPublicKeys = [computePublicKey(entityWallet.publicKey, true)]

const { censusId } = await CensusOffChainApi.addCensus(censusIdSuffix, managerPublicKeys, entityWallet, gw)

const claimsList = [
  { key: encodePublicKey("<eth-hex-pubkey-1>"), value: "<optional-hex-weight>" },
  { key: encodePublicKey("<eth-hex-pubkey-2>"), value: "<optional-hex-weight>" }
]
const { invalidClaims, censusRoot } = await CensusOffChainApi.addClaimBulk(censusId, claimList, entityWallet, gw)
const censusUri = await CensusOffChainApi.publishCensus(censusId, entityWallet, gw)
const dumpedMerkleTree = await CensusOffChainApi.dump(censusId, entityWallet, gw)

// Voter
const wallet = ProviderUtil.fromInjectedWeb3()
const proof = await CensusOffChainApi.generateProof(processParams.censusRoot, { key: encodePublicKey(wallet.signingKey.publicKey) }, gw)
```

### Merkle proofs (on-chain)

```ts
import { CensusOnChainApi } from "@vocdoni/census"
import { Poseidon } from "@vocdoni/hasning"
import { ProviderUtil } from "@vocdoni/client"
import { Random } from "@vocdoni/common"

const processId = "0x1234..."
const proof = {...} // Merkle proof from above
const secretKey = Random.getBigint(Poseidon.Q)
const wallet = ProviderUtil.fromInjectedWeb3()

const result = await CensusOnChainApi.registerVoterKey(
  processId,
  proof,
  secretKey,
  weight = "0x1",
  wallet,
  gw
)
```

### ERC20 proofs

```ts
import { CensusErc20Api } from "@vocdoni/census"
import { Erc20TokensApi } from "@vocdoni/client"

if (!await Erc20TokensApi.isRegistered(config.tokenAddress, gw)) {
    await CensusErc20Api.registerTokenAuto(
        config.tokenAddress,
        wallet,
        gw
    )
}

const tokenInfo = await CensusErc20Api.getTokenInfo(config.tokenAddress, gw)
const { balanceMappingPosition, isRegistered, isVerified } = tokenInfo

const blockNumber = (await gw.provider.getBlockNumber()) - 1

const proof = await CensusErc20Api.generateProof(
    config.tokenAddress,
    wallet.address,
    tokenInfo.balanceMappingPosition,
    blockNumber,
    gw.provide
)
```

### Blind signature proofs

```ts
import { CensusCaApi } from "@vocdoni/census"
import { hexStringToBuffer } from "@vocdoni/common"
import { CAbundle, IProofCA, ProofCaSignatureTypes } from "@vocdoni/data-models"
import { keccak256 } from "@ethersproject/keccak256"
import { hexlify } from "@ethersproject/bytes"

// Request a blinding token
const cspRequest1 = {
    // any additional fields to prove that you are an eligible voter
    certificate: "<base64-payload>",
    // ...
}
const hexTokenR: string = (await axios.post("https://csp/auth", cspRequest1)).data?.response?.token

// Blinding
const tokenR = CensusCaApi.decodePoint(hexTokenR)
const wallet = Wallet.createRandom() // ephemeral wallet
const caBundle = CAbundle.fromPartial({
    processId: new Uint8Array(hexStringToBuffer(processId)),
    address: new Uint8Array(hexStringToBuffer(wallet.address)),
})
const hexCaBundle = hexlify(CAbundle.encode(caBundle).finish())
const hexCaHashedBundle = keccak256(hexCaBundle).substring(2)

const { hexBlinded, userSecretData } = CensusCaApi.blind(hexCaHashedBundle, tokenR)

// Request signature over a blind payload
const cspRequest2 = {
  token: hexTokenR,
  messageHash: hexBlinded
}
const hexBlindSignature = (await axios.post("https://csp/sigh", cspRequest2)).data?.response?.caSignature

// Unblind
const unblindedSignature = CensusCaApi.unblind(hexBlindSignature, userSecretData)

const proof: IProofCA = {
    type: ProofCaSignatureTypes.ECDSA_BLIND,
    signature: unblindedSignature,
    voterAddress: wallet.address
}

```

## Testing

To execute library tests just run

```bash
npm run test
```
