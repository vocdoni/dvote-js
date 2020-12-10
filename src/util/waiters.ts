import { VotingApi } from "../api/voting"
import { IGateway, Gateway } from "../net/gateway"
import { IGatewayPool } from "../net/gateway-pool"

// VOTING BLOCKCHAIN

export class VochainWaiter {
    /** Waits until the Vochain block height has increased by N units */
    static async wait(blockCount: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
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
                        resolve()
                        clearInterval(interval)
                    }
                }).catch(err => reject(err))
            }, 2000)
        })
    }

    /** Waits until the given block number is reached on the Vochain */
    static async waitUntil(targetBlockHeight: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
        const currentBlock = await VotingApi.getBlockHeight(gateway)

        if (currentBlock >= targetBlockHeight) return
        return VochainWaiter.wait(targetBlockHeight - currentBlock, gateway, params)
    }
}

// ETHEREUM

export class EthWaiter {
    /** Waits until the Ethereum block height has increased by N units */
    static async wait(blockCount: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
        if (typeof blockCount != "number") throw new Error("Invalid parameters")

        const gw: Gateway = gateway instanceof Gateway ? gateway : gateway.activeGateway

        const targetBlock = blockCount + await gw.provider.getBlockNumber()

        if (params && params.verbose) console.log("Waiting for eth block", targetBlock)

        await new Promise((resolve, reject) => {
            let lastBlock: number
            const interval = setInterval(() => {
                gw.provider.getBlockNumber().then(currentBlock => {
                    if (currentBlock != lastBlock) {
                        if (params && params.verbose) console.log("Now at eth block", currentBlock)
                        lastBlock = currentBlock
                    }
                    if (currentBlock >= targetBlock) {
                        resolve()
                        clearInterval(interval)
                    }
                }).catch(err => reject(err))
            }, 2000)
        })
    }

    /** Waits until the given block number is reached on the Ethereum blockchain */
    static async waitUntil(targetBlockHeight: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
        const gw: Gateway = gateway instanceof Gateway ? gateway : gateway.activeGateway
        const currentBlock = await gw.provider.getBlockNumber()

        if (currentBlock >= targetBlockHeight) return
        return EthWaiter.wait(targetBlockHeight - currentBlock, gateway, params)
    }
}
