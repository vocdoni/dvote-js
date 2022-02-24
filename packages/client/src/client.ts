import { Signer } from "@ethersproject/abstract-signer";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";

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
import { BytesSignature, JsonLike, JsonSignature } from "@vocdoni/signing";
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
import { ClientNoWalletSignerError } from "./errors/client";

export class Client {
  private _vocdoniEndpoints: string[] = [];
  private _web3Endpoints: (string | JsonRpcProvider)[] = [];
  private _signer: Signer | Wallet;

  constructor(
    endpoints: string | string[],
    web3Endpoints?: (string | JsonRpcProvider) | (string | JsonRpcProvider)[],
    signer?: Signer | Wallet,
  ) {
    if (Array.isArray(endpoints)) {
      this._vocdoniEndpoints = endpoints;
    } else if (typeof endpoints === "string") {
      this._vocdoniEndpoints = [endpoints];
    } else {
      throw new Error("Invalid endpoint or endpoints");
    }

    if (web3Endpoints) {
      if (Array.isArray(web3Endpoints)) {
        this._web3Endpoints = web3Endpoints;
      } else if (typeof web3Endpoints === "string") {
        this._web3Endpoints = [web3Endpoints];
      } else {
        throw new Error("Invalid web endpoint or endpoints");
      }
    }

    if (signer) {
      this.useSigner(signer);
    }
  }

  static fromBootnode(bootnodeUri: string): Promise<Client> {
    // TODO:
  }

  // static fromInfo(info: ClientInfo): Promise<Client> {
  //   // TODO:
  // }

  entity = {
    setMetadata: (id: string, metadata: EntityMetadata): Promise<void> => { },
    getMetadata: (id: string): Promise<EntityMetadata> => { },
  };

  voting = {
    getProcess: (processId: string): Promise<ProcessDetails> => { },
    getProcessState: (processId: string): Promise<ProcessState> => { },
    // getProcessSummary(processId: string) {},
    getProcessList: (filters: {
      entityId?: string;
      status?: VochainProcessStatus;
      withResults?: boolean;
      from?: number;
    }): Promise<string> => { },
    newProcess: (params: INewProcessParams): Promise<string> => { },
    signaling: {
      newProcess: (params: INewProcessErc20Params): Promise<string> => { },
    },
    getMetadata: (processId: string): Promise<ProcessMetadata> => { },
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
      ): Promise<bigint> => { },
      getCircuitInfo: (processId: string): Promise<ProcessCircuitInfo> => { },
      fetchVKey: () => { },
      fetchZKey: () => { },
      fetchWitnessGenerator: () => { },
    },

    getBallot: (processId: string, nullifier: string | bigint): Promise<EnvelopeFull> => { },
    getBallotStatus: (
      processId: string,
      nullifier: string | bigint,
    ): Promise<{ registered: boolean; date: Date; block: number }> => {
      // const { registered, date, block } = await VotingApi.getEnvelopeStatus(processId, nullifier, gwPool)
    },
    getBallotCount: (processId: string): Promise<number> => { },
    getBallotList: (entityId: string): Promise<EnvelopeMeta[]> => { },
    getEncryptionKeys: (processId: string): Promise<ProcessKeys> => { },
    results: {
      getRaw: (processId: string): Promise<RawResults> => { },
      getWeight: (processId: string): Promise<bigint> => { },
      // Deprecated
      put: () => { },
    },
    // Contract deprecated methods
    setStatus: (
      processId: string,
      newStatus: VochainProcessStatus,
    ): Promise<void> => { },
    incrementQuestionIndex: (processId: string): Promise<void> => { },

    // waiters
    waitProcess: (processId: string): Promise<void> => { },
    waitBallot: (processId: string, nullifier: string | bigint): Promise<void> => { },
  };

  census = {
    offChain: {
      put: (
        items: { pubKey: string; value?: Uint8Array }[],
      ): Promise<{ censusUri: string; censusRoot: string }> => {
        // TODO: CensusOffChain.Public.encodePublicKey(pubKey)
        // TODO: value => base64
      },
      getProof: (censusRoot: string, pubKey: string, value?: Uint8Array): Promise<IProofArbo> => {
        // TODO: CensusOffChain.Public.encodePublicKey(pubKey)
        // TODO: value => base64
      },
      verifyProof: () => { },
    },
    onChain: {
      registerVoterKey: (processId: string, secretKey: bigint) => {

        // // Get a census proof to be able to register the new key
        // const censusProof = await Census.getProof(processParams.censusRoot, { pubKey: account.publicKeyEncoded })
        // const requestedWeight = censusProof.weight

        // const proof = Voting.packageSignedProof(processId, processParams.censusOrigin, censusProof)

        // return CensusOnChainApi.registerVoterKey(processId, proof, secretKey, requestedWeight)
      },
      getProof: (rollingCensusRoot: string, secretKey: bigint, value?: Uint8Array): Promise<{ index: bigint; siblings: bigint[]; }> => {
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
      ): Promise<IProofEVM> => { },
      getStorageHash: (
        tokenAddress: string,
        // balanceMapSlot: number,
        targetEvmBlock: number,
      ): Promise<string> => { },
      verifyProof: () => { },
      getTokenInfo: (tokenAddress: string): Promise<{
        isRegistered: boolean;
        isVerified: boolean;
        balanceMapSlot: number;
      }> => { },
      registerToken: () => { },
      verifyMapSlot: () => { },
    },
  };

  blockchain = {
    getBlockStatus: () => { },
    getBlockHeight: () => { },
    estimateBlockAtDateTime: () => { },
    estimateDateAtBlock: () => { },
    waitTransaction: (txHash: string): Promise<void> => { }
  };

  web3 = {
    getBlockNumber: (): Promise<number> => { },
  };

  // PUBLIC METHODS

  useSigner(walletOrSigner: Signer | Wallet) {
    if (!this._signer) throw new Error("Empty wallet or signer");

    this._signer = walletOrSigner;
  }

  signMessage(payload: Uint8Array | string | JsonLike): Promise<string> {
    if (!this._signer) {
      throw new ClientNoWalletSignerError();
    }

    if (payload instanceof Uint8Array) {
      return BytesSignature.signMessage(payload, this._signer);
    } else if (typeof payload === "string") {
      const bytes = new TextEncoder().encode(payload);
      return BytesSignature.signMessage(bytes, this._signer);
    }
    return JsonSignature.signMessage(payload as JsonLike, this._signer);
  }

  signTransaction(
    payload: Uint8Array | string | JsonLike,
    chainId: string,
  ): Promise<string> {
    if (!this._signer) {
      throw new ClientNoWalletSignerError();
    }

    if (payload instanceof Uint8Array) {
      return BytesSignature.signTransaction(payload, chainId, this._signer);
    } else if (typeof payload === "string") {
      const bytes = new TextEncoder().encode(payload);
      return BytesSignature.signTransaction(bytes, chainId, this._signer);
    }
    return JsonSignature.signTransaction(
      payload as JsonLike,
      chainId,
      this._signer,
    );
  }

  getAddress() {
    if (!this._signer) {
      return Promise.reject(
        new ClientNoWalletSignerError(),
      );
    }

    return this._signer.getAddress();
  }

  // PRIVATE IMPLEMENTATION
}
