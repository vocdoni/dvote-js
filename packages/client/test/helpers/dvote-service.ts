import * as express from "express"
import { NextFunction, Request, Response } from "express"
import { json } from "body-parser"
import { Server } from "http";
import { Wallet } from "@ethersproject/wallet"
import { computePublicKey } from "@ethersproject/signing-key"
import { TextEncoder } from "util"
import { BytesSignature } from "@vocdoni/signing"
import { DVoteGateway, GatewayInfo } from "../../src"
import { getWallets } from "./web3-service"
import { BackendApiName, GatewayApiName } from "../../src/apis/definition"


export type TestResponse = {
    id: string,
    response: TestResponseBody,
    signature: string
}
export type TestResponseBody = {
    ok: boolean
    message?: string
    timestamp?: number
    [key: string]: any
}
export type MockedInteraction = {
    requested?: any,                 // What the client actually sent
    responseData: TestResponseBody     // What to send as a response
}

const defaultPort = 8500
const defaultConnectResponse: TestResponseBody = { ok: true, apiList: ["file", "vote", "census", "results"], health: 100 } as { ok: boolean, apiList: (GatewayApiName | BackendApiName)[], health: number }

// THE GATEWAY SERVER MOCK

/**
 * Starts a web socket server that mimicks the bevahour of a DVote Gateway.
 * It allows to predefine the responses to send and it signs the messages sent back.
 */
export class DevGatewayService {
    private port: number
    private server: Server
    public interactionList: MockedInteraction[] = []
    public interactionCount: number = 0
    public readonly wallet: Wallet

    constructor(params: { port?: number, responses?: TestResponseBody[] } = {}) {
        if (params.responses && params.responses.some(res => typeof res != "object")) throw new Error("Invalid response provided")

        this.port = params.port || defaultPort
        this.interactionList = (params.responses || [defaultConnectResponse]).map(response => ({
            requested: null,             // no requests received yet
            responseData: response
        }))

        // Choose a pseudorandom wallet from the end of the ones available [5..9]
        const wallets = getWallets().slice(5)
        const idx = Number(Math.random().toString().substr(2)) % wallets.length
        this.wallet = wallets[idx]
    }

    public start(): Promise<void> {
        return this.stop().then(() => {
            const app = express()
            app.use(json())
            app.post("/dvote", (req, res, next) => this.handleRequest(req, res, next))

            return new Promise((resolve) => {
                this.server = app.listen(this.port, () => resolve())
            })
        })
    }

    public stop(): Promise<void> {
        if (!this.server || !this.server.listening) return Promise.resolve()

        return new Promise((resolve, reject) => this.server.close(err => {
            if (err) reject(err)
            else resolve()
        }))
    }

    private async handleRequest(req: Request, res: Response, next?: NextFunction) {
        try {
            const idx = this.interactionCount
            if (idx >= this.interactionList.length) throw new Error("The Gateway received more requests than expected: " + (this.interactionCount + 1))
            else if (!this.interactionList[idx]) throw new Error("The mock interaction is empty")

            this.interactionList[idx].requested = req.body

            const response = this.interactionList[idx].responseData
            response.request = this.interactionList[idx].requested.id
            response.timestamp = Math.floor(Date.now() / 1000)
            const responseData: TestResponse = {
                id: this.interactionList[idx].requested.id,
                response,
                signature: ""
            }
            const responseBytes = new TextEncoder().encode(JSON.stringify(response))
            responseData.signature = await BytesSignature.signMessage(responseBytes, this.wallet)
            this.interactionCount++
            res.send(responseData)
        }
        catch (err) {
            console.error("DVOTE DEV SERVICE ERROR", err)
        }
    }

    public addResponse(res: TestResponseBody) {
        if (typeof res != "object") throw new Error("Invalid response provided")

        this.interactionList.push({
            requested: null,      // no request received yet
            responseData: res
        })
    }

    // GETTERS
    get uri() { return `http://localhost:${this.port}/dvote` }
    get privateKey() { return this.wallet.privateKey }
    get publicKey() { return computePublicKey(this.wallet.publicKey, true) }
    get client() {
        return new DVoteGateway({ uri: this.uri, supportedApis: ["file", "census", "vote", "results"], publicKey: this.publicKey })
    }
    get gatewayInfo() {
        return new GatewayInfo(this.uri, ["file", "vote", "census", "results"], "http://dummy", this.publicKey)
    }
}
