import { Wallet } from "@ethersproject/wallet"
import { BaseProvider, JsonRpcProvider } from "@ethersproject/providers"
import * as ganache from "ganache-core"
import { ProviderUtil } from "@vocdoni/client"

// TYPES

export type TestAccount = {
    privateKey: string,
    address: string,
    provider: BaseProvider,
    wallet: Wallet
}

const defaultPort = 8600
const defaultMnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"

const walletIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const wallets = walletIndexes.map(idx => Wallet.fromMnemonic(defaultMnemonic, `m/44'/60'/0'/0/${idx}`))

export function getWallets() { return wallets }

/**
 * Starts an in-memory disposable Ethereum blockchain and funds 10 accounts with test ether.
 */
export class DevWeb3Service {
    port: number
    rpcServer: any
    accounts: TestAccount[]
    provider: JsonRpcProvider

    constructor(params: { port?: number, mnemonic?: string } = {}) {
        this.port = params.port || defaultPort
        this.provider = ProviderUtil.fromUri(this.uri)
        this.accounts = walletIndexes.map(idx => {
            const wallet = Wallet.fromMnemonic(params.mnemonic || defaultMnemonic, `m/44'/60'/0'/0/${idx}`).connect(this.provider)
            return {
                privateKey: wallet.privateKey,
                address: wallet.address,
                provider: wallet.provider as BaseProvider,
                wallet
            }
        })
    }

    get uri() { return `http://localhost:${this.port}` }

    start(): Promise<any> {
        this.stop()

        this.rpcServer = (ganache as any).server({ time: new Date(), mnemonic: defaultMnemonic })

        return new Promise((resolve, reject) => this.rpcServer.listen(this.port, (err, info) => {
            if (err) return reject(err)
            resolve(info)
        }))
    }

    stop(): void {
        if (this.rpcServer) this.rpcServer.close()
        this.rpcServer = null
    }

    // UTILS

    /** In development, increments the timestamp by N seconds and returns the new timestamp */
    incrementTimestamp(seconds = 10): Promise<number> {
        return this.provider.send('evm_increaseTime', [seconds])
            .then(() => this.provider.send("evm_mine", []))
            .then(() => this.provider.getBlockNumber())
            .then(blockNumber => this.provider.getBlock(blockNumber))
            .then(block => block.timestamp)
    }

    /** In development, forces the creation of a new block right away */
    mineBlock(): Promise<any> {
        return this.provider.send("evm_mine", [])
    }
}
