import "mocha"; // using @types/mocha
import { expect } from "chai";
import { addCompletionHooks } from "../mocha-hooks";
import DevServices, { TestAccount } from "../helpers/all-services";
import { BackendApiName, Client, GatewayApiName } from "../../src";
import {
  INewProcessParams,
  IProofCA,
  ProofCaSignatureTypes,
  VochainCensusOrigin,
  VochainProcessStatus,
} from "@vocdoni/data-models";
import { ProcessEnvelopeType, ProcessMode } from "@vocdoni/contract-wrappers";
import { Random } from "@vocdoni/common";
import { Poseidon } from "@vocdoni/hashing";

let server: DevServices;

let accounts: TestAccount[];
// let baseAccount: TestAccount
let entityAccount: TestAccount;
let voterAccount1: TestAccount;
let voterAccount2: TestAccount;

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
    voterAccount1 = accounts[2];
    voterAccount2 = accounts[3];

    await server.start();
  });
  afterEach(() => server.stop());

  describe("Network requests", () => {
    it("Should support global network requests", async () => {
      // Entity
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();
    });
  });

  describe("Lifecycle", () => {
    it("Should support an off-chain census voting flow", async () => {
      // Entity
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();

      await client.entity.setMetadata(entityId, {} as any);
      await client.entity.getMetadata(entityId);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: voterAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: voterAccount2.wallet.publicKey,
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

      const processDetails = await client.voting.getProcess(processId);
      const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      client.useSigner(voterAccount1.wallet);

      // Voter proof
      const proof = await client.census.offChain.getProof(
        censusRoot,
        voterAccount1.wallet.publicKey,
      );

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof,
        processDetails.state.censusOrigin,
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
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(entityAccount.wallet);
      const entityId = await client.getAddress();

      await client.entity.setMetadata(entityId, {} as any);
      await client.entity.getMetadata(entityId);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: voterAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: voterAccount2.wallet.publicKey,
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

      const processDetails = await client.voting.getProcess(processId);
      const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      client.useSigner(voterAccount1.wallet);

      // Voter proof
      const proof: IProofCA = {
        type: ProofCaSignatureTypes.ECDSA_BLIND_PIDSALTED,
        signature:
          "0x1234567890123456789012345678901234567890123456789012345678901234",
        voterAddress: voterAccount2.wallet.address,
      };

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof,
        processDetails.state.censusOrigin,
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
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(voterAccount1.wallet);

      // Holder proof
      const targetEvmBlock = await client.web3.getBlockNumber();
      const tokenInfo = await client.census.erc20.getTokenInfo(tokenAddress);
      const storageHash = await client.census.erc20.getStorageHash(
        tokenAddress,
        // tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.AUTO_START,
        envelopeType: ProcessEnvelopeType.make({}),
        censusRoot: storageHash,
        censusOrigin: VochainCensusOrigin.ERC20,
        tokenAddress,
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

      const processDetails = await client.voting.getProcess(processId);
      // const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId: tokenAddress });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      // Voter EVM proof
      const proof2 = await client.census.erc20.getProof(
        tokenAddress,
        voterAccount1.address,
        // tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof2,
        processDetails.state.censusOrigin,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });

    it("Should support an ERC20 token-based voting flow (signaling via Oracle)", async () => {
      const tokenAddress = "0x1234567890123456789012345678901234567890";

      // Entity
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(voterAccount1.wallet);

      // Holder proof
      const targetEvmBlock = await client.web3.getBlockNumber();
      const tokenInfo = await client.census.erc20.getTokenInfo(tokenAddress);
      const storageHash = await client.census.erc20.getStorageHash(
        tokenAddress,
        // tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.AUTO_START,
        envelopeType: ProcessEnvelopeType.make({}),
        censusRoot: storageHash,
        censusOrigin: VochainCensusOrigin.ERC20,
        tokenAddress,
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
      const oracleClient = new Client(
        server.dvote.uri,
        [server.web3.uri],
        voterAccount1.wallet,
      );
      const processId = await oracleClient.voting.signaling.newProcess(
        processParams,
      );

      await client.voting.waitProcess(processId);
      const processDetails = await client.voting.getProcess(processId);
      // const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId: tokenAddress });

      // Encryption keys
      const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
        processId,
      );

      // Voter EVM proof
      const proof2 = await client.census.erc20.getProof(
        tokenAddress,
        voterAccount1.address,
        // tokenInfo.balanceMapSlot,
        targetEvmBlock,
      );

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.signed.submitBallot(
        processId,
        choices,
        proof2,
        processDetails.state.censusOrigin,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });

    it("Should support an anonymous zkSnarks voting flow", async () => {
      const tokenAddress = "0x1234567890123456789012345678901234567890";

      // Entity
      const client = await Client.fromBootnode(server.bootnodeUri, "mainnet");
      // client.useSigner(new providers.JsonRpcSigner());
      client.useSigner(voterAccount1.wallet);

      // Census
      const { censusUri, censusRoot } = await client.census.offChain.put([{
        pubKey: voterAccount1.wallet.publicKey,
        value: new Uint8Array([1, 2, 3]),
      }, {
        pubKey: voterAccount2.wallet.publicKey,
        value: new Uint8Array([2, 3, 4]),
      }]);

      // Election
      const processParams: INewProcessParams = {
        mode: ProcessMode.make({
          autoStart: true,
          interruptible: true,
          preregister: true,
        }),
        envelopeType: ProcessEnvelopeType.make({
          encryptedVotes: false,
          anonymousVoters: true,
        }),
        censusOrigin: VochainCensusOrigin.OFF_CHAIN_TREE,
        censusRoot,
        censusUri,
        startBlock: 50,
        blockCount: 100,
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
      const processDetails = await client.voting.getProcess(processId);
      // const fetchedMetadata = await client.voting.getMetadata(processId);
      await client.voting.getProcessList({ entityId: tokenAddress });

      // Encryption keys
      // const { encryptionPubKeys } = await client.voting.getEncryptionKeys(
      //   processId,
      // );

      // Register anonymous key
      // Generate the random secret key that will be used for voting
      const secretKey = Random.getBigInt(Poseidon.Q);

      const txHash = await client.census.onChain.registerVoterKey(
        processId,
        secretKey,
      );
      await client.blockchain.waitTransaction(txHash);

      // Submit vote
      const choices = [0, 1, 2, 3, 4];
      const nullifier = await client.voting.anonymous.submitBallot(
        processId,
        choices,
        secretKey,
      );
      await client.voting.waitBallot(processId, nullifier);

      // Read vote
      const voteStatus = await client.voting.getBallotStatus(
        processId,
        nullifier,
      );
      const vote = await client.voting.getBallot(processId, nullifier);

      // Read results
      const results = await client.voting.results.getRaw(processId);
      const resultsWeight = await client.voting.results.getWeight(processId);
      const voteCount = await client.voting.getBallotCount(processId);
      const votes = await client.voting.getBallotList(processId);
    });
  });

  it("Should use and change signer", async () => {
    const client = new Client("https://gateway/dvote");
    expect(await client.getAddress()).to.throw;

    client.useSigner(entityAccount.wallet);
    expect(await client.getAddress()).to.eq(entityAccount.address);

    client.useSigner(voterAccount1.wallet);
    expect(await client.getAddress()).to.eq(voterAccount1.address);
  });
});
