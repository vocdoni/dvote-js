import * as React from "react";
import { useEffect } from "react";
import { useState } from "react";
import { BytesSignature, JsonSignature } from "@vocdoni/signing";
import { useSigner, UseSignerProvider } from "../lib/useSigner";
import { Wallet } from "ethers";
import { computeAddress } from "ethers/lib/utils";

const TEXT_MESSAGE = "hello world";
const BYTES_MESSAGE = new TextEncoder().encode(TEXT_MESSAGE);

const MainPage = () => {
  return (
    <UseSignerProvider>
      <Page />
    </UseSignerProvider>
  );
};

const Page = () => {
  const [statusMsg, setStatusMsg] = useState("");
  const { signer, methods, status } = useSigner();

  useEffect(() => {
    // automatically try to connect to MetaMask
    methods.selectWallet();
  }, []);

  const signWithSigner = () => {
    if (!signer) {
      return alert("The JSON RPC signer is not available (Metamask)");
    }
    const jsonPayload = { value: TEXT_MESSAGE };

    JsonSignature.signMessage(jsonPayload, signer)
      .then((signature) => {
        const recoveredPubKey = JsonSignature.recoverMessagePublicKey(
          jsonPayload,
          signature,
        );
        const recoveredAddress = computeAddress(recoveredPubKey);
        setStatusMsg((status) =>
          ("JSON Signature: " + signature +
            "\nRecovered address: " + recoveredAddress).trim() +
          "\n\n" + status
        );

        return BytesSignature.signMessage(BYTES_MESSAGE, signer);
      })
      .then((signature) => {
        const recoveredPubKey = BytesSignature.recoverMessagePublicKey(
          BYTES_MESSAGE,
          signature,
        );
        const recoveredAddress = computeAddress(recoveredPubKey);
        setStatusMsg((status) =>
          ("Bytes Signature: " + signature +
            "\nRecovered address: " + recoveredAddress).trim() +
          "\n\n" + status
        );
      });
  };

  const signWithWallet = () => {
    const wallet = Wallet.createRandom();
    const jsonPayload = { value: TEXT_MESSAGE };

    setStatusMsg((status) =>
      (status + "\n\nSigning with " + wallet.address).trim()
    );

    JsonSignature.signMessage(jsonPayload, wallet)
      .then((signature) => {
        const recoveredPubKey = JsonSignature.recoverMessagePublicKey(
          jsonPayload,
          signature,
        );
        const recoveredAddress = computeAddress(recoveredPubKey);
        setStatusMsg((status) =>
          ("JSON Signature: " + signature +
            "\nRecovered address: " + recoveredAddress).trim() +
          "\n\n" + status
        );

        return BytesSignature.signMessage(BYTES_MESSAGE, wallet);
      })
      .then((signature) => {
        const recoveredPubKey = BytesSignature.recoverMessagePublicKey(
          BYTES_MESSAGE,
          signature,
        );
        const recoveredAddress = computeAddress(recoveredPubKey);
        setStatusMsg((status) =>
          ("Bytes Signature: " + signature +
            "\nRecovered address: " + recoveredAddress).trim() +
          "\n\n" + status
        );
      });
  };

  return (
    <div>
      <h2>Signatures</h2>
      <p>See the console for the output</p>
      <p>Status: ({status})</p>
      <div>
        {status === "connected"
          ? <button onClick={methods.disconnect}>Disconnect</button>
          : <button onClick={methods.selectWallet}>Connect</button>}
        &nbsp;&nbsp;&nbsp;
        {status === "connected"
          ? <button onClick={signWithSigner}>Sign with Signer</button>
          : null}
        &nbsp;&nbsp;&nbsp;
        {status === "connected"
          ? <button onClick={signWithWallet}>Sign with Wallet</button>
          : null}
      </div>
      <hr />
      <pre>{statusMsg}</pre>
    </div>
  );
};

export default MainPage;
