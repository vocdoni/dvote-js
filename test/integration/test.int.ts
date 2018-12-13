import {assert} from "chai";
import Web3 = require("web3");
describe("Web3 dependency", () => {
    const blockchainUrl: string = "http://localhost:8545";

    it("Connects to localhost rpc and gets coinbase address", async () => {
        const web3 = new Web3(new Web3.providers.HttpProvider(blockchainUrl));
        const coinbase = await web3.eth.getCoinbase();
        assert.isNotEmpty(coinbase);
    });
});
