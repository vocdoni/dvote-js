import "mocha"; // using @types/mocha
import { expect } from "chai";
import { addCompletionHooks } from "../mocha-hooks";
import DevServices, {
  DevGatewayService,
  TestAccount,
} from "../helpers/all-services";
import { BackendApiName, Client, GatewayApiName } from "../../src";
import {
  INewProcessParams,
  IProofCA,
  ProofCaSignatureTypes,
  VochainCensusOrigin,
  VochainProcessStatus,
  Wallet,
} from "@vocdoni/data-models";
import { CensusOffChain } from "@vocdoni/census";
import { ProcessEnvelopeType, ProcessMode } from "@vocdoni/contract-wrappers";

const BOOTNODE_URI = "https://bootnodes.vocdoni.net/gateways.stg.json";

let server: DevServices;

let accounts: TestAccount[];
// let baseAccount: TestAccount
let entityAccount: TestAccount;
let randomAccount1: TestAccount;
let randomAccount2: TestAccount;

addCompletionHooks();

let port: number = 9250;

const defaultConnectResponse = {
  timestamp: 123,
  ok: true,
  apiList: ["file", "vote", "census", "results"],
  health: 100,
} as {
  ok: boolean;
  apiList: (GatewayApiName | BackendApiName)[];
  health: number;
};
const defaultDummyResponse = { ok: true };

addCompletionHooks();

describe("DVote gateway client", () => {
  before(() => {
    server = new DevServices({ port: 9001 }, { port: 9002 });
    return server.start();
  });
  after(() => {
    return server.stop();
  });

  beforeEach(async () => {
    accounts = server.accounts;
    entityAccount = accounts[1];
    randomAccount1 = accounts[2];
    randomAccount2 = accounts[3];

    await server.start();
  });
  afterEach(() => server.stop());

  describe("Network requests", () => {
    it("Should support global network requests", async () => {
      // Entity
      const client = await Client.fromBootnode(BOOTNODE_URI);
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();
    });
  });

  describe("Lifecycle", () => {
    it("Should support an off-chain census voting flow", async () => {
      // Entity
      const client = await Client.fromBootnode(BOOTNODE_URI);
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();

      await client.entity.setMetadata(entityId, {} as any);
      await client.entity.getMetadata(entityId);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: randomAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: randomAccount2.wallet.publicKey,
        value: new Uint8Array([2, 3, 4]),
      }]);

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.AUTO_START,
        envelopeType: ProcessEnvelopeType.make({}),
        censusUri,
        censusRoot,
        censusOrigin: VochainCensusOrigin.OFF_CHAIN_TREE,
        blockCount: 100,
        startBlock: 50,
        costExponent: 1,
        maxCount: 1,
        metadata: {
          version: "1.1",
          title: { default: "hi" },
          description: { default: "ho" },
          media: { header: "https://" },
          questions: [
            {
              title: { default: "Q" },
              choices: [{ title: { default: "A" }, value: 0 }],
            },
          ],
          results: {
            aggregation: "discrete-counting",
            display: "linear-weighted",
          },
        },
        maxTotalCost: 0,
        maxValue: 5,
        maxVoteOverwrites: 0,
        paramsSignature:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      };
      const processId = await client.voting.newProcess(processParams);
      await client.voting.waitProcess(processId);

      const processState = await client.voting.getProcess(processId);
      const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      client.useSigner(randomAccount1.wallet);

      // Voter proof
      const proof = await client.census.offChain.getProof(censusRoot, {
        pubKey: randomAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      });

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof,
        processState.state.censusOrigin,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      client.useSigner(entityAccount.wallet);

      // End election
      await client.voting.setStatus(processId, VochainProcessStatus.ENDED);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });

    it("Should support a CSP based voting flow", async () => {
      // Entity
      const client = await Client.fromBootnode(BOOTNODE_URI);
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();

      await client.entity.setMetadata(entityId, {} as any);
      await client.entity.getMetadata(entityId);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: randomAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: randomAccount2.wallet.publicKey,
        value: new Uint8Array([2, 3, 4]),
      }]);

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.AUTO_START,
        envelopeType: ProcessEnvelopeType.make({}),
        censusUri: "https://csp.host/endpoint",
        censusRoot: "csp-public-key",
        censusOrigin: VochainCensusOrigin.OFF_CHAIN_CA,
        blockCount: 100,
        startBlock: 50,
        costExponent: 1,
        maxCount: 1,
        metadata: {
          version: "1.1",
          title: { default: "hi" },
          description: { default: "ho" },
          media: { header: "https://" },
          questions: [
            {
              title: { default: "Q" },
              choices: [{ title: { default: "A" }, value: 0 }],
            },
          ],
          results: {
            aggregation: "discrete-counting",
            display: "linear-weighted",
          },
        },
        maxTotalCost: 0,
        maxValue: 5,
        maxVoteOverwrites: 0,
        paramsSignature:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      };
      const processId = await client.voting.newProcess(processParams);
      await client.voting.waitProcess(processId);

      const processState = await client.voting.getProcess(processId);
      const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      client.useSigner(randomAccount1.wallet);

      // Voter proof
      const proof: IProofCA = {
        type: ProofCaSignatureTypes.ECDSA_BLIND_PIDSALTED,
        signature:
          "0x1234567890123456789012345678901234567890123456789012345678901234",
        voterAddress: randomAccount2.wallet.address,
      };

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof,
        processState.state.censusOrigin,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      client.useSigner(entityAccount.wallet);

      // End election
      await client.voting.setStatus(processId, VochainProcessStatus.ENDED);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });

    it("Should support an ERC20 token-based voting flow (via Ethereum)", async () => {
      const tokenAddress = "0x1234567890123456789012345678901234567890";

      // Entity
      const client = await Client.fromBootnode(BOOTNODE_URI);
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();

      await client.entity.setMetadata(entityId, {} as any);
      await client.entity.getMetadata(entityId);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: randomAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: randomAccount2.wallet.publicKey,
        value: new Uint8Array([2, 3, 4]),
      }]);

      // Holder proof
      const targetEvmBlock = await client.web3.getBlockNumber();
      const tokenInfo = await client.census.erc20.getTokenInfo(tokenAddress);
      const storageHash = await client.census.erc20.getStorageHash(
        tokenAddress,
        tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.AUTO_START,
        envelopeType: ProcessEnvelopeType.make({}),
        censusRoot: storageHash,
        censusOrigin: VochainCensusOrigin.ERC20,
        blockCount: 100,
        startBlock: 50,
        costExponent: 1,
        maxCount: 1,
        metadata: {
          version: "1.1",
          title: { default: "hi" },
          description: { default: "ho" },
          media: { header: "https://" },
          questions: [
            {
              title: { default: "Q" },
              choices: [{ title: { default: "A" }, value: 0 }],
            },
          ],
          results: {
            aggregation: "discrete-counting",
            display: "linear-weighted",
          },
        },
        maxTotalCost: 0,
        maxValue: 5,
        maxVoteOverwrites: 0,
        paramsSignature:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      };
      const processId = await client.voting.newProcess(processParams);
      await client.voting.waitProcess(processId);

      const processState = await client.voting.getProcess(processId);
      const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      client.useSigner(randomAccount1.wallet);

      // Voter proof
      const proof2 = await client.census.erc20.getProof(
        tokenAddress,
        randomAccount1.address,
        tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof2,
        processState.state.censusOrigin,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      client.useSigner(entityAccount.wallet);

      // End election
      await client.voting.setStatus(processId, VochainProcessStatus.ENDED);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });
  });

  it("Should support an ERC20 token-based voting flow (signaling via Oracle)");
  it("Should support an anonymous zkSnarks voting flow");

  it("Should use and change signer", async () => {
    const client = new Client("https://gateway/dvote");
    expect(await client.getAddress()).to.throw;

    client.useSigner(entityAccount.wallet);
    expect(await client.getAddress()).to.eq(entityAccount.address);

    client.useSigner(randomAccount1.wallet);
    expect(await client.getAddress()).to.eq(randomAccount1.address);
  });
});
