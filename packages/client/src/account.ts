import { Wallet } from "@ethersproject/wallet"
import { DVoteGateway } from "gateway-dvote"
import { hexStringToBuffer, Random, uintArrayToHex } from "@vocdoni/common"
import { Tx, wrapRawTransaction } from "@vocdoni/data-models"
import { CollectFaucetTx, FaucetPackage, FaucetPayload, MintTokensTx, SendTokensTx, SetAccountDelegateTx, SetAccountInfoTx, TxType } from "@vocdoni/data-models/dist/protobuf/build/ts/vochain/vochain"
import { BytesSignature, signRaw } from "@vocdoni/signing"
import { Writer } from "protobufjs"


export class Account {
    readonly wallet: Wallet;
    readonly isTreasurer: boolean;
    conn: DVoteGateway;
    chainID: string;

    constructor(wallet: Wallet, isTreasurer = false) {
        this.wallet = wallet
        this.isTreasurer = isTreasurer
    }
    async setGw(conn: DVoteGateway) {
        this.conn = conn
        this.chainID = await conn.getVocdoniChainId()
    }
    address() {
        return this.wallet.address
    }
    signAndSendTx(tx: Writer) {
        const txBytes = tx.finish()
        return BytesSignature.signTransaction(txBytes, this.chainID, this.wallet).then(hexSignature => {
            const signature = new Uint8Array(hexStringToBuffer(hexSignature))
            const request = wrapRawTransaction(txBytes, signature)
            return this.conn.sendRequest(request)
        })
    }
    async setInfo(infoURI: string) {
        const setAccountInfo: SetAccountInfoTx = {
            txtype: TxType.SET_ACCOUNT_INFO, // I shouldn't have to do this.
            infoURI: infoURI,
            nonce: 0,
            account: new Uint8Array(hexStringToBuffer(this.wallet.address)),
        }

        const tx = Tx.encode({ payload: { $case: "setAccountInfo", setAccountInfo } })
        return this.signAndSendTx(tx)
    }
    getInfo() {
        if (this.isTreasurer) {
            return this.conn.sendRequest({ method: "getTreasurer", "entityId": this.wallet.address })
        }
        return this.conn.sendRequest({ method: "getAccount", "entityId": this.wallet.address })
    }
    getNonce() {
        return this.getInfo().then(response => {
            return response.nonce
        })
    }
    async send(recipient: string, amount: number) {
        const sendTokens: SendTokensTx = {
            txtype: TxType.SEND_TOKENS,
            nonce: await this.getNonce(),
            from: new Uint8Array(hexStringToBuffer(this.wallet.address)),
            to: new Uint8Array(hexStringToBuffer(recipient)),
            value: amount,
        }
        const tx = Tx.encode({ payload: { $case: "sendTokens", sendTokens: sendTokens } })
        return this.signAndSendTx(tx)
    }
    async mint(recipient: string, amount: number) {
        const mintTokens: MintTokensTx = {
            txtype: TxType.MINT_TOKENS,
            nonce: await this.getNonce(),
            to: new Uint8Array(hexStringToBuffer(recipient)),
            value: amount,
        }
        const tx = Tx.encode({ payload: { $case: "mintTokens", mintTokens: mintTokens } })
        return this.signAndSendTx(tx)
    }
    async genFaucet(recipient: string, amount: number) {
        const payload: FaucetPayload = {
            identifier: Random.Int(0, Number.MAX_SAFE_INTEGER),
            to: new Uint8Array(hexStringToBuffer(recipient)),
            amount: amount,
        }
        // for signing FaucetPayload, we don't want 'Vocdoni signed message' as
        // a prefix. We just want to sign the raw serialized FaucetPayload. Thus
        // we must use signRaw, not BytesSignature.signVocdoniMessage.
        const pSigned = await signRaw(FaucetPayload.encode(payload).finish(), this.wallet)
        const fPackage: FaucetPackage = {
            payload: payload,
            signature: new Uint8Array(hexStringToBuffer(pSigned)),

        }
        const serializedPackage = FaucetPackage.encode(fPackage).finish()
        return uintArrayToHex(serializedPackage)
    }
    async claimFaucet(faucetPackage: string) {
        const collectFaucet: CollectFaucetTx = {
            txType: TxType.COLLECT_FAUCET,
            faucetPackage: FaucetPackage.decode(hexStringToBuffer(faucetPackage))
        }
        const tx = Tx.encode({ payload: { $case: "collectFaucet", collectFaucet: collectFaucet } })
        return this.signAndSendTx(tx)
    }
    async addDelegate(delegate: string) {
        const setDelegate: SetAccountDelegateTx = {
            txtype: TxType.ADD_DELEGATE_FOR_ACCOUNT,
            nonce: await this.getNonce(),
            delegate: new Uint8Array(hexStringToBuffer(delegate))
        }
        const tx = Tx.encode({ payload: { $case: "setAccountDelegateTx", setAccountDelegateTx: setDelegate } })
        return this.signAndSendTx(tx)
    }
    async delDelegate(delegate: string) {
        const setDelegate: SetAccountDelegateTx = {
            txtype: TxType.DEL_DELEGATE_FOR_ACCOUNT,
            nonce: await this.getNonce(),
            delegate: new Uint8Array(hexStringToBuffer(delegate))
        }
        const tx = Tx.encode({ payload: { $case: "setAccountDelegateTx", setAccountDelegateTx: setDelegate } })
        return this.signAndSendTx(tx)
    }
}

export async function generateFaucetPackage(from: Wallet, recipient: string, amount: number, identifier: number) {
    const payload = generateFaucetPayload(recipient, amount, identifier)
    const payloadSerialized = FaucetPayload.encode(payload).finish()
    const pSigned = await signRaw(payloadSerialized, from)
    const fPackage: FaucetPackage = {
        payload,
        signature: new Uint8Array(hexStringToBuffer(pSigned)),
    }
    return fPackage
}

export function generateFaucetPayload(recipient: string, amount: number, identifier: number) {
    const payload: FaucetPayload = {
        identifier,
        to: new Uint8Array(hexStringToBuffer(recipient)),
        amount,
    }
    return payload
}