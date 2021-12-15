import * as React from 'react'
import { useState } from 'react'
import { VotingApi, EntityApi, ProcessDetails } from "@vocdoni/voting"
import { EntityMetadata } from "@vocdoni/data-models"
import { getClient } from "../lib/net"

const ENTITY_ID = "0x9b2dd5db2b5ba506453a832fffa886e10ec9ac71"
const PROCESS_IDS = [
  "0x0ff269fddb899671d1f54c81a906f6becd1a3770781c04f7b4f8fcdd96226af8",
  "0x8e4948bd579628b49d865705f07ea5d100bbf99d254c22649dea850feef62abe"
]

const Page = () => {
  const [loading, setLoading] = useState(false)
  const [entity, setEntity] = useState<EntityMetadata>(null as any)
  const [processDetails, setProcessDetails] = useState<ProcessDetails>(null as any)

  const loadMetadata = () => {
    setLoading(true)
    getClient()
      .then(gwPool => {
        return Promise.all([
          EntityApi.getMetadata(ENTITY_ID, gwPool),
          VotingApi.getProcess(PROCESS_IDS[0], gwPool)
        ])
      })
      .then(results => {
        setLoading(false)

        setEntity(results[0])
        setProcessDetails(results[1])
      })
      .catch(err => {
        setLoading(false)

        alert("Could not connect to the network nodes: " + err.message)
      })
  }

  return <div>
    <h2>Metadata and details</h2>
    <p>Status: ({loading ? "loading" : "ready"})</p>
    <h3>Entity</h3>
    <p><code>{ENTITY_ID}</code></p>
    <pre>{JSON.stringify(entity, null, 2)}</pre>
    <h3>Process</h3>
    <p><code>{PROCESS_IDS[0]}</code></p>
    <pre>{JSON.stringify(processDetails, null, 2)}</pre>
    {!loading ? <p><button onClick={loadMetadata}>Fetch data</button></p> : null}
  </div>
}

export default Page
