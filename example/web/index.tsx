import 'regenerator-runtime/runtime'
import * as React from 'react'
import { useState } from 'react'
import * as ReactDOM from 'react-dom'
import { FileApi, GatewayDiscovery, GatewayPool, VotingApi } from 'dvote-js'

const BOOTNODE_URI = "https://bootnodes.vocdoni.net/gateways.dev.json"
const ENVIRONMENT = "dev"
const NETWORK_ID = "rinkeby"
const IPFS_URI = "ipfs://QmZfA85BB2MWbkUWhg86SCe64QqAtWaMhwFxgTMTDv4rjC"
const ENTITY_ID = "0x797B8Eb02e670bcd36AA6146c4766577E8EA9059"
const PROCESS_IDS = [
  "0x732493935542b276402ad380e905d5363df798e19342a4d59c057f02060de313",
  "0xb499d66d6262e76d35a596d05a8b2a5c53a04431d71be767ab0d39b71c1d7ceb",
  "0xc0f019b3497412e49107b7eb8e01e72a29e54643aa1e109971c0db7495426539",
  "0x29a4637797076a0620ecf1f4c6565616bbdbb80ed12df36f4125efe9e12706ad"
]

const discoveryParams = {
  bootnodesContentUri: BOOTNODE_URI,
  networkId: NETWORK_ID as any,
  environment: ENVIRONMENT as any
}

const App = () => {
  return (
    <div>
      <GatewayPoolComponent />
      <FileApiComponent />
    </div>
  )
}

const FileApiComponent = () => {
  const [loading, setLoading] = useState(false)
  const [bytes, setBytes] = useState(new Uint8Array())
  const [string, setString] = useState("")

  const loadFile = () => {
    setLoading(true)
    getClient()
      .then(gwPool => {

        // Do something with the gateway pool instance
        return Promise.all([
          FileApi.fetchBytes(IPFS_URI, gwPool),
          FileApi.fetchString(IPFS_URI, gwPool),
        ])
      })
      .then(results => {
        setLoading(false)

        setBytes(results[0])
        setString(results[1])
      })
      .catch(err => {
        setLoading(false)

        alert("Could not connect to the network nodes: " + err.message)
      })
  }

  return <div>
    <h2>File API</h2>
    <p>Status: ({loading ? "loading" : "ready"})</p>
    <p>URI: <code>{IPFS_URI}</code></p>
    <h3>String value</h3>
    <pre>{string}</pre>
    <h3>Bytes value</h3>
    <pre>{bytes.slice(0, 32).join(", ")}...</pre>
    {!loading && !string ? <p><button onClick={loadFile}>Fetch file</button></p> : null}
  </div>
}

const GatewayPoolComponent = () => {
  const [loading, setLoading] = useState(false)
  const [dvoteClient, setDvoteClient] = useState("")
  const [web3Client, setWeb3Client] = useState("")

  const loadPool = () => {
    setLoading(true)
    getClient()
      .then((gwPool: GatewayPool) => {
        setDvoteClient(gwPool.dvoteUri)
        setWeb3Client(gwPool.web3Uri)
      })
      .catch((err) => {
        alert("Could not create the Gateway Pool: " + err.message)
      })
      .finally(() => setLoading(false))
  }

  return <div>
    <h2>Gateway Pool</h2>
    <p>Status: ({loading ? "loading" : "ready"})</p>
    <h3>Active Dvote Client URI</h3>
    <pre>{dvoteClient}</pre>
    <h3>Active Web3 Client URI</h3>
    <pre>{web3Client}</pre>
    {!loading ? <p><button onClick={loadPool}>Create pool</button></p> : null}
  </div>
}

// HELPERS

const getClient = () => {
  return GatewayPool.discover(discoveryParams)
    .then((gwPool: GatewayPool) => gwPool)
}

ReactDOM.render(<App />, document.getElementById('root'))
