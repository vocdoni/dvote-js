
import { Wallet, providers } from "ethers"
import { Web3Gateway } from "../../src/net/gateway"
import * as ganache from "ganache-core"

export class DevWeb3Service {
    port: number
    mnemonic: string
    rpcServer: any
    accounts: TestAccount[]

    constructor(port: number = 8600, mnemonic: string = "myth like bonus scare over problem client lizard pioneer submit female collect") {
        this.port = port
        this.mnemonic = mnemonic

        const wallets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => {
            return Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`).connect(this.provider)
        })

        this.accounts = wallets.map(wallet => ({
            privateKey: wallet.privateKey,
            address: wallet.address,
            provider: wallet.provider,
            wallet
        }))
    }

    get url() { return `http://localhost:${this.port}` }

    get provider() {
        const gw = new Web3Gateway(this.url)
        return gw.getProvider() as providers.Web3Provider
    }

    start(): Promise<any> {
        this.stop()

        this.rpcServer = (ganache as any).server({ time: new Date(), mnemonic: this.mnemonic })

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

export type TestAccount = {
    privateKey: string,
    address: string,
    provider: providers.Provider,
    wallet: Wallet
}
