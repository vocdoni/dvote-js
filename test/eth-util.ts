import { ethers } from "ethers"
import { provider } from "ganache-cli"

export const mnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"

const localProvider = new ethers.providers.Web3Provider(provider({
    time: new Date(),
    mnemonic
}))

const wallets: ethers.Wallet[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => {
    return ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`).connect(localProvider)
})

const accounts: TestAccount[] = []
Promise.all(wallets.map(wallet => {
    return wallet.getAddress().then(address => {
        accounts.push({
            privateKey: wallet.privateKey,
            address,
            provider: wallet.provider,
            wallet
        })
    })
}))

// GETTERS

export function getAccounts() {
    return accounts
}

// UTILITIES

export function increaseTimestamp(seconds = 10): Promise<number> {
    return localProvider.send('evm_increaseTime', [seconds]).then(() => {
        return localProvider.send("evm_mine", [])
    }).then(() => {
        return localProvider.getBlockNumber()
    }).then(blockNumber => {
        return localProvider.getBlock(blockNumber)
    }).then(block => block.timestamp)
}

// TYPES

export type TestAccount = {
    privateKey: string,
    address: string,
    provider: ethers.providers.Provider,
    wallet: ethers.Wallet
}
