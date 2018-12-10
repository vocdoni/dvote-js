import {assert} from "chai";
import Web3 = require("web3");

describe("Array", () =>  {
  describe("#indexOf()", () =>  {
    it("should return -1 when the value is not present", () =>  {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
  });
});

describe("fetchExternalData", () => {
  it("");
});

describe("web3 dependency", () => {
  it("works", async () => {
    const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    const coinbase = await web3.eth.getCoinbase();
    assert.equal(coinbase, "0x6172c8fc696133385f89fa4ca687c59ad288b37a");
  });
});
