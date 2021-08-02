import * as React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import { BytesSignature, FileApi, JsonSignature } from 'dvote-js'
import { useWallet, UseWalletProvider } from 'use-wallet'
import { providers, utils, Wallet } from 'ethers'

const TEXT_MESSAGE = "hello world"
const BYTES_MESSAGE = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50, 51, 52, 53, 54, 70, 71, 72, 73, 200, 201])

const MainPage = () => {
  return <UseWalletProvider
    chainId={4}
    connectors={{
    }}
  >
    <Page />
  </UseWalletProvider>
}

const Page = () => {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const wallet = useWallet()
  const signer = useSigner()

  useEffect(() => {
    // automatically try to connect to MetaMask
    wallet.connect()
  }, [])

  const signWithSigner = () => {
    if (!signer) return alert("The JSON RPC signer is not available (Metamask)")
    const jsonPayload = { value: TEXT_MESSAGE }

    JsonSignature.sign(jsonPayload, signer)
      .then(signature => {

        const strJson = JSON.stringify(jsonPayload)
        const recoveredAddress = recoverAddress(strJson, signature)
        setStatus(status => (status + "\n\nJSON Signature: " + signature + "\nRecovered address: " + recoveredAddress).trim())

        return BytesSignature.sign(BYTES_MESSAGE, signer)
      })
      .then(signature => {
        const recoveredAddress = recoverAddress(BYTES_MESSAGE, signature)
        setStatus(status => (status + "\n\nBytes Signature: " + signature + "\nRecovered address: " + recoveredAddress).trim())
      })
  }

  const signWithWallet = () => {
    const wallet = Wallet.createRandom()
    const jsonPayload = { value: TEXT_MESSAGE }

    setStatus(status => (status + "\n\nSigning with " + wallet.address).trim())

    JsonSignature.sign(jsonPayload, wallet)
      .then(signature => {
        const strJson = JSON.stringify(jsonPayload)
        const recoveredAddress = recoverAddress(strJson, signature)
        setStatus(status => (status + "\n\nJSON Signature: " + signature + "\nRecovered address: " + recoveredAddress).trim())

        return BytesSignature.sign(BYTES_MESSAGE, wallet)
      })
      .then(signature => {
        const recoveredAddress = recoverAddress(BYTES_MESSAGE, signature)
        setStatus(status => (status + "\n\nBytes Signature: " + signature + "\nRecovered address: " + recoveredAddress).trim())
      })
  }

  return <div>
    <h2>Signatures</h2>
    <p>See the console for the output</p>
    <p>Status: ({loading ? "loading" : "ready"})</p>
    <pre>{status}</pre>
    {!loading ? <p><button onClick={signWithSigner}>Sign with Signer</button></p> : null}
    {!loading ? <p><button onClick={signWithWallet}>Sign with Wallet</button></p> : null}
  </div>
}

// HELPERS

function useSigner() {
  const wallet = useWallet<providers.JsonRpcFetchFunc>();

  if (!wallet?.ethereum || !wallet?.account) return null;

  const provider = new providers.Web3Provider(wallet.ethereum);
  return provider.getSigner(wallet.account);
}

function recoverAddress(msg: string | Buffer, sig: string) {
  if (!sig.startsWith("0x")) sig = "0x" + sig
  return utils.verifyMessage(msg, sig)
}

export default MainPage
