
// import GatewayInfo from "../../src/wrappers/gateway-info";
// const ganacheRpcServer = require("ganache-core").server

// const port = 8500
// const gatewayUri = `ws://localhost:${port}`
// const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")

// // Web3 node
// const rpcServer = ganacheRpcServer()
// const info: any = await new Promise(resolve => rpcServer.listen(port, (err, info) => resolve(info)))

// expect(Object.keys(info.personal_accounts).length).to.be.approximately(10, 9)
// expect(Object.keys(info.personal_accounts)[0]).to.match(/^0x[0-9a-fA-F]{40}$/)

// const addr = Object.keys(info.personal_accounts)[0]

// const gatewayUri = `http://localhost:${port}`
// const gw = new Web3Gateway(gatewayUri)
// const gwProvider = gw.getProvider()
// const balance = await gwProvider.getBalance(addr)

// expect(balance.toHexString()).to.match(/^0x[0-9a-fA-F]{10,}$/)

// // webSocketServer.stop()
// rpcServer.close()


export default class DevServices {
    constructor() {
        // TODO: Start WS service
        // TODO: Start Web3 service
    }
}
