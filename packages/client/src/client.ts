import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"
import { EntityMetadata } from "@vocdoni/data-models"
import { JsonLike, JsonSignature } from "@vocdoni/signing"
import { ClientInfo } from "./wrappers/client-info"


export class Client {
  private _vocdoniClients
  private _web3Clients
  private _signer: Signer
  private _wallet: Wallet

  constructor() {

  }

  static fromBootnode(bootnodeUri: string): Promise<Client> {

  }

  static fromInfo(info: ClientInfo): Promise<Client> {

  }

  get signer(): Signer {
    // TODO
  }

  get wallet(): Wallet {
    // TODO
  }

  entity = {
    setMetadata(id: string, metadata: EntityMetadata): Promise<void> { },
    getMetadata(id: string): Promise<EntityMetadata> { }
  }

  voting = {
    getProcess(id: string) { },
    getProcessSummary(id: string) { },
    getProcessList() { },
    newProcess() { },
    getMetadata() { },
    signaling: {
      newProcess() { }
    },
    submitVote() { },
    getVote() { },
    getVoteStatus() { },
    getVoteCount() { },
    getVoteList() { },
    getEncryptionKeys() { },
    network: {
      getBlockStatus() { },
      getBlockHeight() { },
      estimateBlockAtDateTime() { },
      estimateDateAtBlock() { },
    },
    getResults() { },
    getResultsWeight() { },
    snarks: {
      getCircuitInfo() { },
      fetchVKey() { },
      fetchZKey() { },
      fetchWitnessGenerator() { },
    },
    setStatus() { },

    // Deprecated
    setResults() { },
  }







  census = {
    offChain: {
      pinCensus() { },
      getProof() { },
      verifyProof() { }
    },
    erc20: {
      getProof() { },
      verifyProof() { },
      getTokenInfo() { },
      registerToken() { },
      verifyMapSlot() { },
    }
  }

  // PUBLIC METHODS

  signMessage(payload: Uint8Array | string | JsonLike): Promise<string> {
    if (!this.signer && !this.wallet) throw new Error("The client has no signer or wallet defined")

    if (payload instanceof Uint8Array) {

    }
    else if (typeof payload === "string") {

    }

    return JsonSignature.signMessage(payload, this.signer || this.wallet)
  }

  signTransaction(payload: Uint8Array | string | JsonLike, chainId: string): Promise<string> {
    if (!this.signer && !this.wallet) throw new Error("The client has no signer or wallet defined")

    if (payload instanceof Uint8Array) {

    }
    else if (typeof payload === "string") {

    }

    return JsonSignature.signTransaction(payload, chainId, this.signer || this.wallet)
  }

  // PRIVATE IMPLEMENTATION
}
