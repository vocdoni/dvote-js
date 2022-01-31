import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { DevGatewayService, TestAccount } from "../helpers/all-services"
import { BackendApiName, Client, GatewayApiName } from "../../src"

let server: DevServices
// let accounts: TestAccount[]
// let baseAccount: TestAccount
// let entityAccount: TestAccount
// let randomAccount: TestAccount
// let entityNode: string
// let contractInstance: EnsResolverContractMethods & Contract

addCompletionHooks()

let port: number = 9250

const defaultConnectResponse = { timestamp: 123, ok: true, apiList: ["file", "vote", "census", "results"], health: 100 } as { ok: boolean, apiList: (GatewayApiName | BackendApiName)[], health: number }
const defaultDummyResponse = { ok: true }

addCompletionHooks()

describe("DVote gateway client", () => {
  let dvoteServer: DevGatewayService
  beforeEach(() => {
    dvoteServer = new DevGatewayService({ port })
    return dvoteServer.start()
  })
  afterEach(() => dvoteServer.stop())

  describe("Lifecycle", () => {
    it("Should", async () => {
      const client = await Client.fromBootnode("https://")
      client.file
    })
  })
})
