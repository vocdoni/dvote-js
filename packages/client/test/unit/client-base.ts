import "mocha"; // using @types/mocha
import { expect } from "chai";
import { addCompletionHooks } from "../../../common/test/mocha-hooks";
import { Buffer } from "buffer/";

import { ClientBase } from "../../src/client-base";
import { Wallet } from "@ethersproject/wallet";
import { IRequestParameters } from "../../src/interfaces";
import { JsonSignature } from "@vocdoni/signing";

addCompletionHooks();

// Extended class to make protected methods public
class MyClient extends ClientBase {
  public makeRequest(body: IRequestParameters, { skipSigning }: {
    skipSigning?: boolean;
  } = {}) {
    return super.makeRequest(body, { skipSigning });
  }

  public handleResponse(
    bytes: Uint8Array,
    expectedId: string,
  ): { [k: string]: any; ok: boolean; message?: string } {
    return super.handleResponse(bytes, expectedId);
  }
}

describe("Vocdoni Client (base)", () => {
  it("Should make requests", async () => {
    const wallet1 = Wallet.createRandom();
    const wallet2 = Wallet.createRandom();
    const client = new MyClient("http://dummy", "", wallet1);

    const req1 = await client.makeRequest({ method: "addCensus" });
    expect(req1.id).to.be.ok;
    expect(req1.request.method).to.deep.eq({ method: "addCensus" });
    expect(req1.signature).to.be.ok;

    const req2 = await client.makeRequest({ method: "addFile" });
    expect(req2.id).to.be.ok;
    expect(req2.request.method).to.deep.eq({ method: "addFile" });
    expect(req2.signature).to.be.ok;

    client.useSigner(wallet2);
    const req3 = await client.makeRequest({ method: "addCensus" });
    expect(req3.id).to.be.ok;
    expect(req3.request.method).to.deep.eq({ method: "addCensus" });
    expect(req3.signature).to.eq(req1.signature);
  });

  it("Should validate responses", async () => {
    const wallet = Wallet.createRandom();
    const client = new MyClient(
      { uri: "http://dummy", publicKey: wallet.publicKey },
      "",
    );

    const expectedSignature1 = JsonSignature.signMessage({ ok: true }, wallet);
    const bytes1 = new TextEncoder().encode(
      `{"id":"1234","response":{"ok":true},"signature":"${expectedSignature1}"}`,
    );
    const response1 = client.handleResponse(bytes1, "1234");
    expect(response1.ok).to.be.true;

    const expectedSignature2 = JsonSignature.signMessage({ ok: false }, wallet);
    const bytes2 = new TextEncoder().encode(
      `{"id":"2345","response":{"ok":false},"signature":"${expectedSignature2}"}`,
    );
    const response2 = client.handleResponse(bytes2, "2345");
    expect(response2.ok).to.be.false;
  });
});
