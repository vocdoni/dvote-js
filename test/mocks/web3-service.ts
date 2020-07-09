
import { Wallet, providers } from "ethers"
import { Web3Gateway } from "../../src/net/gateway"
import * as ganache from "ganache-core"

// TYPES

export type TestAccount = {
    privateKey: string,
    address: string,
    provider: providers.BaseProvider,
    wallet: Wallet
}

const defaultPort = 8600
const defaultMnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"

const wallets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => {
    return Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${idx}`).connect(this.provider)
})

const accounts: TestAccount[] = wallets.map(wallet => ({
    privateKey: wallet.privateKey,
    address: wallet.address,
    provider: wallet.provider as providers.BaseProvider,
    wallet
}))

/** Get a list of accounts with test ether available */
export function getAccounts() {
    return accounts
}

/**
 * Starts an in-memory disposable Ethereum blockchain and funds 10 accounts with test ether.
 */
export class DevWeb3Service {
    port: number
    rpcServer: any
    accounts: TestAccount[]

    constructor(params: { port?: number } = {}) {
        this.port = params.port || defaultPort
        this.accounts = accounts
    }

    get uri() { return `http://localhost:${this.port}` }

    get provider() {
        const gw = new Web3Gateway(this.uri)

        // Override health checks
        gw.isUp = () => Promise.resolve()
        gw.isSyncing = () => Promise.resolve(false)

        return gw.getProvider() as providers.Web3Provider
    }

    get gatewayClient() {
        return new Web3Gateway(this.uri)
    }

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

