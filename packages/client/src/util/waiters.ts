import { IGatewayClient, IGatewayDVoteClient, IGatewayWeb3Client } from "vocdoni-net" // TODO reference the future package
import { VotingApi } from "../voting"

// VOTING BLOCKCHAIN

export class VochainWaiter {
    /** Waits until the Vochain block height has increased by N units */
    static async wait(blockCount: number, gateway: IGatewayDVoteClient, params?: { verbose: boolean }) {
        if (typeof blockCount != "number") throw new Error("Invalid parameters")

        const targetBlock = blockCount + await VotingApi.getBlockHeight(gateway)

        if (params && params.verbose) console.log("Waiting for Vochain block", targetBlock)

        await new Promise((resolve, reject) => {
            let lastBlock: number
            const interval = setInterval(() => {
                VotingApi.getBlockHeight(gateway).then(currentBlock => {
                    if (currentBlock != lastBlock) {
                        if (params && params.verbose) console.log("Now at Vochain block", currentBlock)
                        lastBlock = currentBlock
                    }
                    if (currentBlock >= targetBlock) {
                        resolve(null)
                        clearInterval(interval)
                    }
                }).catch(err => reject(err))
            }, 2000)
        })
    }

    /** Waits until the given block number is reached on the Vochain */
    static async waitUntil(targetBlockHeight: number, gateway: IGatewayDVoteClient, params?: { verbose: boolean }) {
        const currentBlock = await VotingApi.getBlockHeight(gateway)

        if (currentBlock >= targetBlockHeight) return
        return VochainWaiter.wait(targetBlockHeight - currentBlock, gateway, params)
    }
}

// ETHEREUM

export class EthWaiter {
    /** Waits until the Ethereum block height has increased by N units */
    static async wait(blockCount: number, gateway: IGatewayWeb3Client, params?: { verbose: boolean }) {
        if (typeof blockCount != "number") throw new Error("Invalid parameters")

        const targetBlock = blockCount + await gateway.provider.getBlockNumber()

        if (params && params.verbose) console.log("Waiting for eth block", targetBlock)

        await new Promise((resolve, reject) => {
            let lastBlock: number
            const interval = setInterval(() => {
                gateway.provider.getBlockNumber().then(currentBlock => {
                    if (currentBlock != lastBlock) {
                        if (params && params.verbose) console.log("Now at eth block", currentBlock)
                        lastBlock = currentBlock
                    }
                    if (currentBlock >= targetBlock) {
                        resolve(null)
                        clearInterval(interval)
                    }
                }).catch(err => reject(err))
            }, 2000)
        })
    }

    /** Waits until the given block number is reached on the Ethereum blockchain */
    static async waitUntil(targetBlockHeight: number, gateway: IGatewayWeb3Client, params?: { verbose: boolean }) {
        const currentBlock = await gateway.provider.getBlockNumber()

        if (currentBlock >= targetBlockHeight) return
        return EthWaiter.wait(targetBlockHeight - currentBlock, gateway, params)
    }
}
