import { Signer } from "@ethersproject/abstract-signer";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BytesSignature, JsonLike, JsonSignature } from "@vocdoni/signing";
import { ClientNoWalletSignerError } from "./errors/client";
import { BackendApiName, GatewayApiName } from "./apis";
import { ProviderUtil } from "./net/providers";
import * as fetchPonyfill from "fetch-ponyfill";
import { VocdoniEnvironment } from "@vocdoni/common";
import { IRequestParameters, IVocdoniNodeResponse } from "./interfaces";

const { fetch, Request, Response, Headers } = fetchPonyfill();

export type VocdoniNodeInfo = {
  uri: string;
  apis?: (GatewayApiName | BackendApiName)[];
  publicKey?: string;
};

type MessageRequestContent = {
  id: string;
  request: IRequestParameters;
  signature?: string;
};

export abstract class ClientBase {
  private _vocdoniEndpoints: VocdoniNodeInfo[] = [];
  private _web3Endpoints: JsonRpcProvider[] = [];
  private _vocdoniIdx = -1;
  private _web3Idx = -1;
  private _signer: Signer | Wallet;
  private _timeOutInLastRequest = false;
  private _environment: VocdoniEnvironment;

  constructor(
    vocdoniEndpoints: string | VocdoniNodeInfo | (string | VocdoniNodeInfo)[],
    web3Endpoints?: string | JsonRpcProvider | (string | JsonRpcProvider)[],
    signer?: Signer | Wallet,
    environment: VocdoniEnvironment = "prod",
  ) {
    // Vocdoni
    if (Array.isArray(vocdoniEndpoints)) {
      if (!vocdoniEndpoints.length) throw new Error("Empty endpoints");

      this._vocdoniEndpoints = vocdoniEndpoints.map((item) => {
        if (typeof item === "string") return { uri: item };
        else return item;
      });
    } else if (typeof vocdoniEndpoints === "object") {
      if (!vocdoniEndpoints.uri) throw new Error("Empty endpoint URI");

      this._vocdoniEndpoints = [vocdoniEndpoints];
    } else if (typeof vocdoniEndpoints === "string") {
      if (!vocdoniEndpoints.length) throw new Error("Empty endpoint URI");

      this._vocdoniEndpoints = [{ uri: vocdoniEndpoints }];
    } else {
      throw new Error("Invalid endpoint details");
    }
    this._vocdoniIdx = 0;

    // Ethereum gateway
    if (web3Endpoints) {
      if (Array.isArray(web3Endpoints)) {
        this._web3Endpoints = web3Endpoints.map((item) => {
          if (typeof item === "string") return ProviderUtil.fromUri(item);
          return item;
        });
      } else if (typeof web3Endpoints === "string") {
        this._web3Endpoints = [ProviderUtil.fromUri(web3Endpoints)];
      } else {
        this._web3Endpoints = [web3Endpoints];
      }
      this._web3Idx = 0;
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

  // PUBLIC METHODS

  /** Replaces the current signer by the given one */
  useSigner(walletOrSigner: Signer | Wallet) {
    if (!walletOrSigner) throw new Error("Empty wallet or signer");

    this._signer = walletOrSigner;
  }

  /** Sets a new environment to target the right smart contracts */
  useEnvironment(environment: VocdoniEnvironment) {
    if (!environment) throw new Error("No environment");

    this._environment = environment;
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

  /** Changes to the next available Vocdoni endpoint */
  shiftNode() {
    if (!this._vocdoniEndpoints.length) throw new Error("No endpoints");
    else if (this._vocdoniEndpoints.length <= 1) {
      throw new Error("No other endpoints");
    }

    this._vocdoniIdx = (this._vocdoniIdx + 1) % this._vocdoniEndpoints.length;
  }

  /** Starts using the next available Web3 endpoints */
  shiftWeb3Node() {
    if (!this._web3Endpoints.length) throw new Error("No endpoints");
    else if (this._web3Endpoints.length <= 1) {
      throw new Error("No other endpoints");
    }

    this._web3Idx = (this._web3Idx + 1) % this._web3Endpoints.length;
  }

  get supportedApis() {
    if (!this._vocdoniEndpoints[this._vocdoniIdx]) return [];
    return this._vocdoniEndpoints[this._vocdoniIdx].apis || [];
  }
  get publicKey() {
    if (!this._vocdoniEndpoints[this._vocdoniIdx]) return null;
    return this._vocdoniEndpoints[this._vocdoniIdx].publicKey || null;
  }
  get environment() {
    return this._environment;
  }

  // GLOBAL

  /** Checks that at least one of the defined endpoints is functional for each type */
  init() {
    // TODO: Check API's
    // Get info
    // Get web3 status
  }

  // VOCDONI

  request(body: IRequestParameters) {
    if (!this._vocdoniEndpoints[this._vocdoniIdx]?.uri) {
      return Promise.reject(new Error("No endpoints"));
    }

    // TODO:
  }

  // WEB3

  // PRIVATE METHODS
}
