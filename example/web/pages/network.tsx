import * as React from 'react'
import { useState } from 'react'
import { FileApi } from "@vocdoni/client"
import { getClient } from "../lib/net"

const IPFS_URI = "ipfs://QmaPrHy12pkxthX8CHeYegGRgVdumv5TEFhUpGAvCyTXPt"

const Page = () => {
  const [loading, setLoading] = useState(false)
  const [bytes, setBytes] = useState(new Uint8Array())
  const [string, setString] = useState("")

  const loadFile = () => {
    setLoading(true)
    getClient()
      .then(gwPool => {
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

export default Page
