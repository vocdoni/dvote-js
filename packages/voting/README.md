# @vocdoni/voting

@vocdoni/voting contains voting helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/voting.

```bash
npm install @vocdoni/voting
```

## Usage

### Entity metadata

```ts
import { EntityApi } from "@vocdoni/voting"
import { EntityMetadataTemplate } from "@vocdoni/data-models"

const ipfsUri = await EntityApi.setMetadata(wallet.address, EntityMetadataTemplate, gw)

const metadata = EntityApi.getMetadata(wallet.address, gw)
```

### Signed vote

```ts
import { VotingApi, INewProcessParams } from "@vocdoni/voting"

// ADMIN - CREATE VOTE

const processParams: INewProcessParams = {
    mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
    envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES, // bit mask
    censusOrigin: ProcessCensusOrigin.OFF_CHAIN_TREE,
    metadata: ProcessMetadataTemplate,
    censusRoot: censusRoot,
    censusUri: "ipfs://1234123412341234",
    startBlock,
    blockCount,
    maxCount: 1,
    maxValue: 3,
    maxTotalCost: 0,
    costExponent: 10000,  // 1.0000
    maxVoteOverwrites: 1,
    paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
}
const processId = await VotingApi.newProcess(processParams, entityWallet, pool)

// VOTER - READ INFO

const allParams = await VotingApi.getProcess(processId, gw)
const vochainParams = await VotingApi.getProcessState(processId, gw)
const summary = await VotingApi.getProcessSummary(processId, gw)
const processMetadata = await VotingApi.getProcessMetadata(processId, gw)

// VOTER - GET CENSUS PROOF (Arbo, CSP, ERC20, etc.)

const censusProof = {...}

const processKeys = processParams.envelopeType.hasEncryptedVotes ?
    await VotingApi.getProcessKeys(processId, pool) : null

const envelope = processParams.envelopeType.hasEncryptedVotes ?
    Voting.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet, processKeys }) :
    Voting.packageSignedEnvelope({ censusOrigin: processParams.censusOrigin, votes: choices, censusProof, processId, walletOrSigner: wallet })

await VotingApi.submitEnvelope(envelope, wallet, pool)

// wait a bit
await new Promise(resolve => setTimeout(resolve, 11000))

const nullifier = Voting.getSignedVoteNullifier(wallet.address, processId)
const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, pool)
```

### Results

```ts
import { VotingApi, Voting } from "@vocdoni/voting"

const rawResults = await VotingApi.getResults(processId, gw)
const processMetadata = await VotingApi.getProcessMetadata(processId, gw)

const scResults = Voting.digestSingleChoiceResults(rawResults, processMetadata, gw)
const sqResults = Voting.digestSingleQuestionResults(rawResults, processMetadata, gw)

const weight = VotingApi.getResultsWeight(processId, gw)
```

### Other

```ts
import { VotingApi, Voting } from "@vocdoni/voting"
import { ProcessStatus } from "dvote-solidity"

const block = await VotingApi.estimateBlockAtDateTime(targetDate, gw)
const date = await VotingApi.estimateBlockAtDateTime(targetBlock, gw)

const blockStatus = await VotingApi.getBlockStatus(gw)

await VotingApi.setStatus(processId, ProcessStatus.ENDED, gw)

const envelope = await VotingApi.getEnvelope(nullifier, gw)
const envelopes = await VotingApi.getEnvelopeStatus(processId, nullifier, gw)

const voteCount = await VotingApi.getEnvelopeHeight(processId, gw)

const processes = await VotingApi.getProcessList({ entityId, status, withResults, from }, gw)

const envelopes = await VotingApi.getEnvelopeList(processId, from, listSize, gw)
```

## Testing

To execute library tests just run

```bash
npm run test
```
