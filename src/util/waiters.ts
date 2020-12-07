import { getBlockHeight } from "../api/voting"
import { IGateway, Gateway } from "../net/gateway"
import { IGatewayPool } from "../net/gateway-pool"

/** Waits until the Vochain block height has increased by N units */
export async function waitVochainBlocks(blocks: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
    if (typeof blocks != "number") throw new Error("Invalid parameters")

    const targetBlock = blocks + await getBlockHeight(gateway)

    if (params && params.verbose) console.log("Waiting for Vochain block", targetBlock)

    await new Promise((resolve, reject) => {
        let lastBlock: number
        const interval = setInterval(() => {
            getBlockHeight(gateway).then(currentBlock => {
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
export async function waitUntilVochainBlock(block: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
    const currentBlock = await getBlockHeight(gateway)

    if (currentBlock >= block) return
    return waitVochainBlocks(block - currentBlock, gateway, params)
}

/** Waits until the Ethereum block height has increased by N units */
export async function waitEthBlocks(blocks: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
    if (typeof blocks != "number") throw new Error("Invalid parameters")

    const gw: Gateway = gateway instanceof Gateway ? gateway : gateway.activeGateway

    const targetBlock = blocks + await gw.provider.getBlockNumber()

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
export async function waitUntilEthBlock(block: number, gateway: IGateway | IGatewayPool, params?: { verbose: boolean }) {
    const gw: Gateway = gateway instanceof Gateway ? gateway : gateway.activeGateway
    const currentBlock = await gw.provider.getBlockNumber()

    if (currentBlock >= block) return
    return waitEthBlocks(block - currentBlock, gateway, params)
}
