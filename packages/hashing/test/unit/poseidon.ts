import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { Poseidon } from "../../src"

addCompletionHooks()

describe("Poseidon hashing", () => {
    it("Should hash big int's", () => {
        const items = [
            {
                input: BigInt("1"),
                output: BigInt('18586133768512220936620570745912940619677854269274689475585506675881198879027')
            },
            {
                input: BigInt("18586133768512220936620570745912940619677854269274689475585506675881198879027"),
                output: BigInt('17744324452969507964952966931655538206777558023197549666337974697819074895989')
            },
        ]

        items.forEach(item => {
            expect(Poseidon.hash([item.input])).to.eq(item.output)
        })
    })

    it("Poseidon hashes should digest bigint arrays", () => {
        const BI_0 = BigInt("0")
        const BI_1 = BigInt("1")
        const BI_2 = BigInt("2")
        const BI_3 = BigInt("3")
        const BI_4 = BigInt("4")
        const BI_5 = BigInt("5")
        const BI_6 = BigInt("6")

        let hash = Poseidon.hash([BI_1])
        expect(hash.toString()).to.eq("18586133768512220936620570745912940619677854269274689475585506675881198879027")

        hash = Poseidon.hash([BI_1, BI_2])
        expect(hash.toString()).to.eq("7853200120776062878684798364095072458815029376092732009249414926327459813530")

        hash = Poseidon.hash([BI_1, BI_2, BI_0, BI_0, BI_0])
        expect(hash.toString()).to.eq("1018317224307729531995786483840663576608797660851238720571059489595066344487")

        hash = Poseidon.hash([BI_1, BI_2, BI_0, BI_0, BI_0, BI_0])
        expect(hash.toString()).to.eq("15336558801450556532856248569924170992202208561737609669134139141992924267169")

        hash = Poseidon.hash([BI_3, BI_4, BI_0, BI_0, BI_0])
        expect(hash.toString()).to.eq("5811595552068139067952687508729883632420015185677766880877743348592482390548")

        hash = Poseidon.hash([BI_3, BI_4, BI_0, BI_0, BI_0, BI_0])
        expect(hash.toString()).to.eq("12263118664590987767234828103155242843640892839966517009184493198782366909018")

        hash = Poseidon.hash([BI_1, BI_2, BI_3, BI_4, BI_5, BI_6])
        expect(hash.toString()).to.eq("20400040500897583745843009878988256314335038853985262692600694741116813247201")
    })

    it("Should fail when out of the field", () => {
        const items = [
            BigInt("-1"),
            Poseidon.Q,
            Poseidon.Q + BigInt("1"),
        ]
        items.forEach(item => {
            try {
                Poseidon.hash([item])
            }
            catch (err) {
                expect(err.message).to.eq("One or more inputs are out of the Poseidon field")
            }
        })
    })
})