import {
  EthNetworkID,
  TextRecordKeys,
  TimeoutError,
  VocdoniEnvironment,
} from "@vocdoni/common";
import {
  EntityMetadata,
  INewProcessErc20Params,
  INewProcessParams,
  IProofArbo,
  IProofCA,
  IProofEVM,
  ProcessMetadata,
  VochainCensusOrigin,
  VochainProcessStatus,
} from "@vocdoni/data-models";
import {
  EnvelopeFull,
  EnvelopeMeta,
  ProcessCircuitInfo,
  ProcessDetails,
  ProcessKeys,
  ProcessState,
  RawResults,
  Voting,
} from "@vocdoni/voting";
import { ClientCore } from "./client-core";
import * as fetchPonyfill from "fetch-ponyfill";
import { JsonBootnodeData } from "./apis/definition";
import { ensHashAddress } from "@vocdoni/contract-wrappers";
import { ContentHashedUri } from "./wrappers/content-hashed-uri";
import { ContentUri } from "./wrappers/content-uri";
import { FileApi } from "./net/file";
import { Buffer } from "buffer/";
import { IRequestParameters } from "./interfaces";

const { fetch } = fetchPonyfill();

export class Client extends ClientCore {
  // HELPERS
  static fromBootnode(
    uri: string,
    networkId: EthNetworkID,
    environment: VocdoniEnvironment = "prod",
  ): Promise<Client> {
    if (!uri) return Promise.reject(new Error("Empty URI"));

    return fetch(uri)
      .then((res) => res.json())
      .then((res: JsonBootnodeData) => {
        if (!res[networkId]) {
          throw new Error(
            "There are no gateways for the given Ethereum Network ID",
          );
        }

        const client = new Client(
          res[networkId].dvote,
          res[networkId].web3.map((v) => v.uri),
          null, // no signer by default
          environment,
        );
        return client.init()
          .then(() => client);
      });
  }

  // CLIENT IMPLEMENTATION

  entity = {
    setMetadata: (
      address: string,
      metadata: EntityMetadata,
    ): Promise<void> => {},
    getMetadata: (address: string): Promise<EntityMetadata> => {
      if (!address) return Promise.reject(new Error("Invalid address"));

      return this.attachEnsPublicResolver()
        .then((resolverInstance) => {
          return resolverInstance.text(
            ensHashAddress(address),
            TextRecordKeys.JSON_METADATA_CONTENT_URI,
          );
        })
        .then((metadataContentUri) => {
          if (!metadataContentUri) {
            throw new Error("The given entity has no metadata");
          }

          return this.file.fetchString(metadataContentUri);
        }).then((jsonData) => {
          if (!jsonData) throw new Error("The given entity has no metadata");
          return JSON.parse(jsonData);
        });
    },
  };

  voting = {
    getProcess: (processId: string): Promise<ProcessDetails> => {},
    getProcessState: (processId: string): Promise<ProcessState> => {},
    // getProcessSummary(processId: string) {},
    getProcessList: (filters: {
      entityId?: string;
      status?: VochainProcessStatus;
      withResults?: boolean;
      from?: number;
    }): Promise<string> => {},
    newProcess: (params: INewProcessParams): Promise<string> => {},
    signaling: {
      newProcess: (params: INewProcessErc20Params): Promise<string> => {},
    },
    getMetadata: (processId: string): Promise<ProcessMetadata> => {},
    /** Applies to elections that use off-chain censuses, CSP signed proofs or Token based voting */
    signed: {
      submitBallot: async (
        processId: string,
        choices: number[],
        proof: IProofArbo | IProofCA | IProofEVM,
        censusOrigin: VochainCensusOrigin,
      ): Promise<string> => {
        // TODO:

        const { encryptionPubKeys } = await this.voting.getEncryptionKeys(
          processId,
        );
        return Voting.getSignedVoteNullifier(
          await this.getAddress(),
          processId,
        );
      },
    },
    /** Applies to anonymous voting using ZK Snarks */
    anonymous: {
      submitBallot: (
        processId: string,
        choices: number[],
        secretKey: bigint,
      ): Promise<bigint> => {},
      getCircuitInfo: (processId: string): Promise<ProcessCircuitInfo> => {},
      fetchVKey: () => {},
      fetchZKey: () => {},
      fetchWitnessGenerator: () => {},
    },

    getBallot: (
      processId: string,
      nullifier: string | bigint,
    ): Promise<EnvelopeFull> => {},
    getBallotStatus: (
      processId: string,
      nullifier: string | bigint,
    ): Promise<{ registered: boolean; date: Date; block: number }> => {
      // const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, gwPool)
    },
    getBallotCount: (processId: string): Promise<number> => {},
    getBallotList: (entityId: string): Promise<EnvelopeMeta[]> => {},
    getEncryptionKeys: (processId: string): Promise<ProcessKeys> => {},
    results: {
      getRaw: (processId: string): Promise<RawResults> => {},
      getWeight: (processId: string): Promise<bigint> => {},
      // Deprecated
      put: () => {},
    },
    // Contract deprecated methods
    setStatus: (
      processId: string,
      newStatus: VochainProcessStatus,
    ): Promise<void> => {},
    incrementQuestionIndex: (processId: string): Promise<void> => {},

    // waiters
    waitProcess: (processId: string): Promise<void> => {},
    waitBallot: (
      processId: string,
      nullifier: string | bigint,
    ): Promise<void> => {},
  };

  census = {
    offChain: {
      put: (
        items: { pubKey: string; value?: Uint8Array }[],
      ): Promise<{ censusUri: string; censusRoot: string }> => {
        // TODO: CensusOffChain.Public.encodePublicKey(pubKey)
        // TODO: value => base64
      },
      getProof: (
        censusRoot: string,
        pubKey: string,
        value?: Uint8Array,
      ): Promise<IProofArbo> => {
        // TODO: CensusOffChain.Public.encodePublicKey(pubKey)
        // TODO: value => base64
      },
      verifyProof: () => {},
    },
    onChain: {
      registerVoterKey: (
        processId: string,
        secretKey: bigint,
      ): Promise<string> => {
        // // Get a census proof to be able to register the new key
        // const censusProof = await Census.getProof(processParams.censusRoot, { pubKey: account.publicKeyEncoded })
        // const requestedWeight = censusProof.weight

        // const proof = Voting.packageSignedProof(processId, processParams.censusOrigin, censusProof)

        // return CensusOnChainApi.registerVoterKey(processId, proof, secretKey, requestedWeight)
      },
      getProof: (
        rollingCensusRoot: string,
        secretKey: bigint,
        value?: Uint8Array,
      ): Promise<{ index: bigint; siblings: bigint[] }> => {
        // TODO: CensusOffChain.Public.encodePublicKey(pubKey)
        // TODO: value => base64
      },
    },
    erc20: {
      getProof: (
        tokenAddress: string,
        holderAddress: string,
        // balanceMapSlot: number,
        targetEvmBlock: number,
      ): Promise<IProofEVM> => {},
      getStorageHash: (
        tokenAddress: string,
        // balanceMapSlot: number,
        targetEvmBlock: number,
      ): Promise<string> => {},
      verifyProof: () => {},
      getTokenInfo: (tokenAddress: string): Promise<{
        isRegistered: boolean;
        isVerified: boolean;
        balanceMapSlot: number;
      }> => {},
      registerToken: () => {},
      verifyMapSlot: () => {},
    },
  };

  blockchain = {
    getBlockStatus: () => {},
    getBlockHeight: () => {},
    estimateBlockAtDateTime: () => {},
    estimateDateAtBlock: () => {},
    waitTransaction: (txHash: string): Promise<void> => {},
  };

  web3 = {
    getBlockNumber: (): Promise<number> => {},
  };

  file = {
    fetchBytes: async (
      contentUri: ContentUri | ContentHashedUri | string,
    ): Promise<Buffer> => {
      if (!contentUri) throw new Error("Invalid contentUri");

      const cUri = ContentHashedUri.resolve(contentUri);

      // Attempt 1: fetch from the given gateway
      if (this.vocdoniUri) {
        try {
          const response = await this.request({
            method: "fetchFile",
            uri: "ipfs://" + cUri.ipfsHash,
          });

          if (!response?.content) {
            throw new Error("Invalid response received from the gateway");
          }

          const result = Buffer.from(response.content, "base64");
          if (cUri.hash && !cUri.verify(result)) {
            throw new Error(
              "The fetched artifact doesn't match the expected hash",
            );
          }
          return result;
        } catch (err) {
          if (!(err instanceof TimeoutError)) throw err;

          // otherwise, continue below
        }
      }

      // Try using alternative methods
      return FileApi.fetchBytesFallback(contentUri);
    },
    fetchString: (contentUri: ContentUri | ContentHashedUri | string) => {
      return this.file.fetchBytes(contentUri)
        .then((bytes: Buffer) => bytes.toString());
    },
    add: (data: Uint8Array | string, name: string): Promise<string> => {
      if (!data) return Promise.reject(new Error("Empty payload"));

      const buffer = Buffer.from(data as any);

      const requestBody: IRequestParameters = {
        method: "addFile",
        type: "ipfs",
        name,
        content: buffer.toString("base64"),
      };

      return this.request(requestBody)
        .then((response) => {
          if (!response?.uri) throw new Error();

          return response.uri;
        })
        .catch((error) => {
          const message = (error.message)
            ? "The data could not be uploaded: " + error.message
            : "The data could not be uploaded";
          throw new Error(message);
        });
    },
  };

  // PRIVATE IMPLEMENTATION
}
