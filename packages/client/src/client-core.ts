import { Signer } from "@ethersproject/abstract-signer";
import { Wallet } from "@ethersproject/wallet";
import {
  InfuraProvider,
  IpcProvider,
  JsonRpcProvider,
  Web3Provider,
} from "@ethersproject/providers";
import { BytesSignature, JsonLike, JsonSignature } from "@vocdoni/signing";
import { ClientNoWalletSignerError } from "./errors/client";
import {
  allApis,
  ApiMethod,
  BackendApiName,
  GatewayApiName,
  InfoApiMethod,
  RawApiMethod,
} from "./apis";
import { ProviderUtil } from "./net/providers";
import * as fetchPonyfill from "fetch-ponyfill";
import {
  ENTITY_RESOLVER_ENS_SUBDOMAIN,
  ERC20_STORAGE_PROOFS_ENS_SUBDOMAIN,
  EthNetworkID,
  GENESIS_ENS_SUBDOMAIN,
  NAMESPACES_ENS_SUBDOMAIN,
  PROCESSES_ENS_SUBDOMAIN,
  promiseWithTimeout,
  Random,
  RESULTS_ENS_SUBDOMAIN,
  TextRecordKeys,
  TimeoutError,
  UnsupportedProtocolError,
  VOCDONI_ENS_ROOT,
  VOCDONI_ENS_ROOT_DEV,
  VOCDONI_ENS_ROOT_STAGING,
  VocdoniEnvironment,
} from "@vocdoni/common";
import {
  IRequestParameters,
  IVocdoniNodeResponse,
  VocdoniNodeInfo,
} from "./interfaces";
import { extractJsonFieldBytes } from "./util/uint8array";
import { Contract, ContractInterface } from "@ethersproject/contracts";
import { getEnsTextRecord } from "./net/ens";
import { GatewayArchiveError } from "./errors/archive";
import {
  EnsResolverContractMethods,
  Erc20StorageProofContractDefinition,
  Erc20StorageProofContractMethods,
  IEnsPublicResolverContract,
  IProcessesContract,
  ITokenStorageProofContract,
  ProcessesContractDefinition,
  ProcessesContractMethods,
  PublicResolverContractDefinition,
} from "@vocdoni/contract-wrappers";

const { fetch, Request, Response, Headers } = fetchPonyfill();
const supportedProtocols = ["https:"];

type MessageRequestContent = {
  id: string;
  request: IRequestParameters;
  signature?: string;
};

export abstract class ClientCore {
  private _vocdoniEndpoints: VocdoniNodeInfo[] = [];
  private _web3Endpoints: JsonRpcProvider[] = [];
  private _vocdoniIdx = -1;
  private _web3Idx = -1;
  private _signer: Signer | Wallet;
  // Environment state
  private _environment: VocdoniEnvironment;
  private _initializingEns?: Promise<any>;
  protected _contractAddresses = {
    ensPublicResolver: "",
    genesis: "",
    namespaces: "",
    processes: "",
    results: "",
    tokenStorageProof: "",
  };
  private _archiveIpnsId = "";

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
        if (typeof item === "string") {
          const url = new URL(item);
          if (!supportedProtocols.includes(url.protocol)) {
            throw new UnsupportedProtocolError(url.protocol);
          }
          return { uri: item };
        } else return item;
      });
    } else if (typeof vocdoniEndpoints === "object") {
      if (!vocdoniEndpoints.uri) throw new Error("Empty endpoint URI");

      this._vocdoniEndpoints = [vocdoniEndpoints];
    } else if (typeof vocdoniEndpoints === "string") {
      const url = new URL(vocdoniEndpoints);
      if (!supportedProtocols.includes(url.protocol)) {
        throw new UnsupportedProtocolError(url.protocol);
      }
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
          if (typeof item === "string") {
            const url = new URL(item);
            if (!supportedProtocols.includes(url.protocol)) {
              throw new UnsupportedProtocolError(url.protocol);
            }
            return ProviderUtil.fromUri(item);
          }
          return item;
        });
      } else if (typeof web3Endpoints === "string") {
        const url = new URL(web3Endpoints);
        if (!supportedProtocols.includes(url.protocol)) {
          throw new UnsupportedProtocolError(url.protocol);
        }
        this._web3Endpoints = [ProviderUtil.fromUri(web3Endpoints)];
      } else {
        this._web3Endpoints = [web3Endpoints];
      }
      this._web3Idx = 0;
    }

    if (signer) {
      this.useSigner(signer);
    }
    this.useEnvironment(environment);
  }

  // GLOBAL

  /** Ensures that at least one of the defined endpoints is functional for each type */
  initAll() {
    return this.initVocdoni().then(() => this.initWeb3());
  }
  /** Ensures that at least one Vocdoni node is functional */
  initVocdoni() {
    // TODO: Check API's
    // Get info
    return Promise.reject();
  }
  /** Ensures that at least one Web3 gateway is functional */
  initWeb3() {
    // TODO:
    // Iterate web3 nodes
    // Find the first where ENS + Check isSyncing is ok

    return this.isSyncing()
      .then((syncing) => {
        if (syncing) throw new Error("The web3 node is syncing");

        return this.initEns();
      })
      .then(() => this.initArchive());
  }

  // PUBLIC METHODS

  /** Replaces the current signer by the given one */
  useSigner(walletOrSigner: Signer | Wallet) {
    if (!walletOrSigner) throw new Error("Empty wallet or signer");

    this._signer = walletOrSigner;
  }

  /** Clears the current signer */
  clearSigner() {
    this._signer = null;
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

  protected get current() {
    return {
      vocdoni: this._vocdoniEndpoints[this._vocdoniIdx] || null,
      web3: this._web3Endpoints[this._web3Idx] || null,
    };
  }
  /** Gets the URI of the currently active Vocdoni Node */
  get vocdoniUri() {
    return this.current.vocdoni?.uri || null;
  }
  /** Gets the supported API's of the currently active Vocdoni Node (if any) */
  get supportedApis() {
    return this.current.vocdoni?.apis || [];
  }
  /** Gets the public key of the currently active Vocdoni Node (if any) */
  get publicKey() {
    if (!this.current.vocdoni) return null;
    return this.current.vocdoni?.publicKey || null;
  }
  /** Gets the Web3 provider of the currently active web3 endpoint (if any) */
  get web3Provider() {
    return this.current.web3 || null;
  }
  get web3Uri() {
    return this.web3Provider["connection"].url;
  }
  get archiveIpnsId() {
    return this._archiveIpnsId;
  }
  get environment() {
    return this._environment;
  }
  get signer() {
    return this._signer;
  }

  // VOCDONI

  async request(
    body: IRequestParameters,
    { skipSigning, timeout }: { skipSigning?: boolean; timeout?: number } = {},
  ) {
    if (!this.vocdoniUri) {
      throw new Error("No endpoints");
    }

    const payload = await this.makeRequest(body, { skipSigning });

    const responsePayload = await promiseWithTimeout(
      fetch(this.vocdoniUri, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      }),
      timeout || 12 * 1000,
    ).catch((err) => {
      if (err instanceof TimeoutError) this.shiftNode();
      throw err;
    });
    const responsePayloadBytes = new Uint8Array(
      await responsePayload.arrayBuffer(),
    );

    return this.handleResponse(responsePayloadBytes, payload.id);
  }

  protected async makeRequest(
    body: IRequestParameters,
    { skipSigning }: { skipSigning?: boolean } = {},
  ): Promise<MessageRequestContent> {
    if (typeof body !== "object") {
      throw new Error("The payload should be a javascript object");
    } else if (!this.supportsMethod(body.method)) {
      throw new Error(
        `The method is not available in the Gateway's supported API's (${body.method})`,
      );
    }

    if (typeof body.timestamp !== "number") {
      body.timestamp = Math.floor(Date.now() / 1000);
    }

    return {
      id: Random.getHex().substring(2, 12),
      request: JsonSignature.sort(body),
      signature: (this.signer && !skipSigning)
        ? await JsonSignature.signMessage(body, this.signer)
        : "",
    };
  }

  protected handleResponse(bytes: Uint8Array, expectedId: string) {
    const msgResponseBytes = extractJsonFieldBytes(bytes, "response");
    const msg: IVocdoniNodeResponse = JSON.parse(
      new TextDecoder().decode(bytes),
    );

    if (!msg.response) {
      throw new Error("Invalid response message");
    }

    const incomingReqId = msg.response.request || null;
    if (incomingReqId !== expectedId) {
      throw new Error("The signed request ID does not match the expected one");
    }

    // Check the signature of the response
    if (this.publicKey) {
      const valid = BytesSignature.isValidMessage(
        msgResponseBytes,
        msg.signature,
        this.publicKey,
      );
      if (!valid) {
        throw new Error(
          "The signature of the response does not match the expected one",
        );
      }
    }

    if (!msg.response.ok) {
      if (msg.response.message) {
        throw new Error(msg.response.message);
      }
      throw new Error(
        "There was an error while handling the request at the gateway",
      );
    }
    return msg.response;
  }

  /**
   * Determines whether the current DVote Gateway supports the API set that includes the given method.
   * NOTE: `updateStatus()` must have been called on the GW instnace previously.
   */
  supportsMethod(method: ApiMethod): boolean {
    if (allApis.info.includes(method as InfoApiMethod)) return true;
    else if (allApis.raw.includes(method as RawApiMethod)) return true;

    for (const api of this.supportedApis) {
      if (api in allApis && allApis[api].includes(method as never)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieves the status of the given gateway and returns an object indicating the services it provides.
   * If there is no connection open, the method returns null.
   */
  getVocdoniInfo(): Promise<
    {
      apiList: Array<GatewayApiName | BackendApiName>;
      health: number;
      chainId: string;
    }
  > {
    if (!this.vocdoniUri) {
      return Promise.reject(new Error("No Vocdoni node is available"));
    }

    return this.request({ method: "getInfo" })
      .then((result) => {
        if (!Array.isArray(result.apiList)) {
          throw new Error("apiList is not an array");
        } else if (typeof result.health !== "number") {
          throw new Error("invalid gateway reply");
        }

        return {
          apiList: result.apiList,
          health: result.health,
          chainId: result.chainId,
        };
      });
  }

  /** Retrieves the chainId of the Vochain */
  getVocdoniChainId() {
    return this.getVocdoniInfo().then((info) => info.chainId);
  }

  // WEB3

  /** Initialize the contract addresses using the currently active web3 gateway */
  public initEns() {
    if (this._initializingEns) return this._initializingEns;
    else if (!this.web3Provider) {
      return Promise.reject(new Error("No Web3 provider"));
    }

    const rootDomain = this.web3RootDomain;

    this._initializingEns = Promise.all([
      this.web3Provider.resolveName(
        ENTITY_RESOLVER_ENS_SUBDOMAIN + "." + rootDomain,
      ),
      this.web3Provider.resolveName(GENESIS_ENS_SUBDOMAIN + "." + rootDomain),
      this.web3Provider.resolveName(
        NAMESPACES_ENS_SUBDOMAIN + "." + rootDomain,
      ),
      this.web3Provider.resolveName(PROCESSES_ENS_SUBDOMAIN + "." + rootDomain),
      this.web3Provider.resolveName(RESULTS_ENS_SUBDOMAIN + "." + rootDomain),
      this.web3Provider.resolveName(
        ERC20_STORAGE_PROOFS_ENS_SUBDOMAIN + "." + rootDomain,
      ),
    ]).then((addresses) => {
      if (addresses.some((addr) => !addr)) {
        throw new Error("One or more contract addresses are empty on ENS");
      }

      this._contractAddresses = {
        ensPublicResolver: addresses[0],
        genesis: addresses[1],
        namespaces: addresses[2],
        processes: addresses[3],
        results: addresses[4],
        tokenStorageProof: addresses[5],
      };

      this._initializingEns = null;
    }).catch((err) => {
      this.shiftWeb3Node();

      this._initializingEns = null;
      throw err;
    });

    return this._initializingEns;
  }

  /** Initialize the archive IPNS ID using the currently active web3 gateway */
  public initArchive() {
    if (this.archiveIpnsId) {
      return Promise.resolve();
    }

    return this.getEthNetworkId()
      .then((networkId) =>
        getEnsTextRecord(this, TextRecordKeys.VOCDONI_ARCHIVE, {
          environment: this.environment,
          networkId: networkId as EthNetworkID,
        })
      )
      .then((uri: string) => {
        if (!uri) throw new GatewayArchiveError();

        this._archiveIpnsId = uri;
      }).catch((err) => {
        this.shiftWeb3Node();

        throw err;
      });
  }

  getEthChainId(): Promise<number> {
    return this.web3Provider.getNetwork().then((network) => network.chainId);
  }

  getEthNetworkId(): Promise<string> {
    return this.web3Provider.getNetwork().then((network) => network.name);
  }

  /** Request the block number of the currently active web3 Gateway */
  getBlockNumber(): Promise<number> {
    if (!this.web3Provider) {
      return Promise.reject(new Error("Empty provider"));
    }

    return this.web3Provider.getBlockNumber();
  }

  /** Determines whether the current Web3 provider is syncing blocks or not.
   *
   * **Warning**: Several types of prviders may always return false. */
  isSyncing(): Promise<boolean> {
    const provider = this.web3Provider;
    if (
      (provider instanceof JsonRpcProvider) ||
      (provider as any) instanceof Web3Provider ||
      (provider as any) instanceof IpcProvider ||
      (provider as any) instanceof InfuraProvider
    ) {
      return this.web3Provider.send("eth_syncing", []).then((result) =>
        !!result
      );
    }

    return Promise.reject(new Error("Invalid provider"));
  }

  /**
   * Use the contract instance at the given address
   * @param address Contract instance address
   * @param ABI The Application Binary Inteface of the contract
   * @return A contract instance attached to the given address
   */
  attachContract<T>(address: string, abi: ContractInterface): (Contract & T) {
    if (typeof address != "string") throw new Error("Invalid contract address");
    else if (!abi) throw new Error("Invalid contract ABI");

    const contract = new Contract(address, abi, this.web3Provider);

    if (!this.signer) return contract as (Contract & T);
    else if (this.signer instanceof Wallet) {
      return contract.connect(
        this.signer.connect(this.web3Provider),
      ) as (Contract & T);
    }

    return contract.connect(this.signer) as (Contract & T);
  }

  /**
   * Returns an ENS Public Resolver contract instance, bound to the current Web3 gateway
   * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
   */
  public async attachEnsPublicResolver(
    customAddress?: string,
  ): Promise<IEnsPublicResolverContract> {
    const abi = PublicResolverContractDefinition.abi as ContractInterface;

    let address: string;
    if (customAddress) address = customAddress;
    else {
      if (!this._contractAddresses.ensPublicResolver) await this.initEns();
      address = this._contractAddresses.ensPublicResolver;
    }

    return this.attachContract<EnsResolverContractMethods>(address, abi);
  }

  /**
   * Returns a Process contract instance, bound to the current Web3 gateway
   * @param customAddress (optional) Overrides the address of the contract instance, instead of the value from `*.voc.eth`
   */
  public async getProcessesInstance(
    customAddress?: string,
  ): Promise<IProcessesContract> {
    const abi = ProcessesContractDefinition.abi as ContractInterface;
    let address: string;
    if (customAddress) address = customAddress;
    else {
      if (!this._contractAddresses.processes) await this.initEns();
      address = this._contractAddresses.processes;
    }

    return this.attachContract<ProcessesContractMethods>(address, abi);
  }

  /**
   * Returns a Token Storage Proof contract instance, bound to the current Web3 gateway
   * @param customAddress (optional) Overrides the address of the contract instance, instead of the address defined within `processes.voc.eth`
   */
  public async getTokenStorageProofInstance(
    customAddress?: string,
  ): Promise<ITokenStorageProofContract> {
    const abi = Erc20StorageProofContractDefinition.abi as ContractInterface;
    let address: string;
    if (customAddress) address = customAddress;
    else {
      if (!this._contractAddresses.tokenStorageProof) await this.initEns();
      address = this._contractAddresses.tokenStorageProof;
    }

    return this.attachContract<Erc20StorageProofContractMethods>(address, abi);
  }

  // SIGNER

  /** Sets a new environment to target the right smart contracts */
  useEnvironment(environment: VocdoniEnvironment) {
    if (!["prod", "stg", "dev"].includes(environment)) {
      throw new Error("Invalid environment");
    } else if (environment === this._environment) return;

    this._environment = environment;
    this._contractAddresses = {
      ensPublicResolver: "",
      genesis: "",
      namespaces: "",
      processes: "",
      results: "",
      tokenStorageProof: "",
    };
    this._initializingEns = null;
    this._archiveIpnsId = "";
  }

  signMessage(payload: Uint8Array | string | JsonLike): Promise<string> {
    if (!this.signer) {
      throw new ClientNoWalletSignerError();
    }

    if (payload instanceof Uint8Array) {
      return BytesSignature.signMessage(payload, this.signer);
    } else if (typeof payload === "string") {
      const bytes = new TextEncoder().encode(payload);
      return BytesSignature.signMessage(bytes, this.signer);
    }
    return JsonSignature.signMessage(payload as JsonLike, this.signer);
  }

  signTransaction(
    payload: Uint8Array | string | JsonLike,
    chainId: string,
  ): Promise<string> {
    if (!this.signer) {
      throw new ClientNoWalletSignerError();
    }

    if (payload instanceof Uint8Array) {
      return BytesSignature.signTransaction(payload, chainId, this.signer);
    } else if (typeof payload === "string") {
      const bytes = new TextEncoder().encode(payload);
      return BytesSignature.signTransaction(bytes, chainId, this.signer);
    }
    return JsonSignature.signTransaction(
      payload as JsonLike,
      chainId,
      this.signer,
    );
  }

  getAddress() {
    if (!this.signer) {
      return Promise.reject(
        new ClientNoWalletSignerError(),
      );
    }

    return this.signer.getAddress();
  }

  // PRIVATE HELPERS

  private get web3RootDomain() {
    switch (this.environment) {
      case "prod":
        return VOCDONI_ENS_ROOT;
      case "stg":
        return VOCDONI_ENS_ROOT_STAGING;
      case "dev":
        return VOCDONI_ENS_ROOT_DEV;
      default:
        throw new Error("Invalid environment");
    }
  }
}
