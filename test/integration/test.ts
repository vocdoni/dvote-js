import {assert} from "chai";
import Web3 = require("web3");
import Config from "../../src/utils/config";

describe("Web3 dependency", () => {
  it("Connects to localhost rpc and gets coinbase address", async () => {
    const web3 = new Web3(new Web3.providers.HttpProvider(Config.BLOCKCHAIN_URL));
    const coinbase = await web3.eth.getCoinbase();
    assert.isNotEmpty(coinbase);
  });
});
