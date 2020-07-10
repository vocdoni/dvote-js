import DevServices, { WSResponse, WSResponseBody, WebSocketMockedInteraction } from "./all-services"

async function example() {
    const services = new DevServices()
    await services.start()

    // DVote client
    const dvoteGw = services.ws.gatewayClient
    await dvoteGw.connect()
    console.log("DVote connected:", await dvoteGw.isConnected())

    // By default, a `getBlockStatus` dummy response is prepared on the GW mock,
    // so that `connect()` will succeed

    services.ws.addResponse({ ok: true, message: "Hello, John" })
    const res = await dvoteGw.sendRequest({ method: "publish", name: "John" })
    console.log("Received", res)

    // Web3 client
    const entityResolverAddr = "0x1234" // optional
    const namespaceAddr = "0x1234" // optional
    const processAddr = "0x1234" // optional

    const web3Gw = services.web3.getGatewayClient(entityResolverAddr, namespaceAddr, processAddr)
    const myInstance = await web3Gw.attach("0x0", [])
    const tx = await myInstance.myMethod()
    await tx.wait()

    // Do your logic here

    await services.stop()
}

example()
