import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { utils } from "ethers"

import { WalletBabyJub, WalletUtil } from "../../src/crypto/wallets"
import { Random } from "../../packages/common/src" // TODO: Import from the new NPM package
import { JsonSignature } from "../../packages/signing/src" // TODO: Import from the new NPM package

addCompletionHooks()

describe("Standalone Ethereum wallets", () => {
    it("Should generate a new random seed for a standalone wallet", () => {
        const seed1 = Random.getHex()
        const seed2 = Random.getHex()
        const seed3 = Random.getHex()
        const seed4 = Random.getHex()

        expect(seed1.length).to.eq(66)
        expect(seed2.length).to.eq(66)
        expect(seed3.length).to.eq(66)
        expect(seed4.length).to.eq(66)

        expect(seed1.substr(0, 2)).to.eq('0x')
        expect(seed2.substr(0, 2)).to.eq('0x')
        expect(seed3.substr(0, 2)).to.eq('0x')
        expect(seed4.substr(0, 2)).to.eq('0x')

        expect(seed1.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed2.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed3.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok
        expect(seed4.match(/^0x[0-9a-fA-F]{64}$/)).to.be.ok

        expect(seed1).to.be.not.eq(seed2)
        expect(seed1).to.be.not.eq(seed3)
        expect(seed1).to.be.not.eq(seed4)
        expect(seed2).to.be.not.eq(seed3)
        expect(seed2).to.be.not.eq(seed4)
        expect(seed3).to.be.not.eq(seed4)
    })

    it("Should return a wallet for the given passphrase and seed", async () => {
        const passphrase = "Hello Dear world 1234"
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        const wallet = WalletUtil.fromSeededPassphrase(passphrase, hexSeed)
        expect(wallet.privateKey).to.eq("0x58c6192cbffe39d20f6dbaa2957a6d6a4116489a2bb66caab5c4a0bfa83d887b")
        expect(utils.computePublicKey(wallet.publicKey, true)).to.eq("0x02de6d532b6979899729f9e98869888ea7fdbc446f9f3ea732d23c7bcd10c784d0")
        expect(wallet.publicKey).to.eq("0x04de6d532b6979899729f9e98869888ea7fdbc446f9f3ea732d23c7bcd10c784d041887d48ebc392c4ff51882ae569ca1553f6ab6538664bced6cca6855acbbade")
        expect(await wallet.getAddress()).to.eq("0xf76564CBF51B1F050c84fC01400088ACD2704F2e")

        const msg = utils.toUtf8Bytes("Hello")
        const signature = await wallet.signMessage(msg)
        expect(signature).to.eq("0xc7f89fabf5185f7b63b5f13ad11a79e69412174ed250e6df7116a27588a820cf21aa94a440519e3a19b545e26b457fc39a0b8e904e1ba591f3bbd9842960c58a1c")
    })

    it("Different passphrases should produce different private keys", async () => {
        const passphrase1 = "Hello Dear world 1234"
        const passphrase2 = "This is a different passphrase 10"
        const passphrase3 = "Three passphrases, 3 wallets"
        const passphrase4 = "$More @ UTF-8 © chãrs àèìòù"
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        const wallet1 = WalletUtil.fromSeededPassphrase(passphrase1, hexSeed)
        const wallet2 = WalletUtil.fromSeededPassphrase(passphrase2, hexSeed)
        const wallet3 = WalletUtil.fromSeededPassphrase(passphrase3, hexSeed)
        const wallet4 = WalletUtil.fromSeededPassphrase(passphrase4, hexSeed)

        expect(wallet1.privateKey).to.not.eq(wallet2.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet3.privateKey).to.not.eq(wallet4.privateKey)
    })

    it("Different seeds should produce different private keys", async () => {
        const passphrase = "Hello Dear world 1234"
        const hexSeed1 = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"
        const hexSeed2 = "0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a"
        const hexSeed3 = "0xf51aeecd5cb3cf2b37e005286976d0335c555708ed7bafa1a770a7f2919e96f3"
        const hexSeed4 = "0xaf1410f438190841ad9b39eebc4dfb1d669018ab92a0cb61bba889dd129fad0e"

        const wallet1 = WalletUtil.fromSeededPassphrase(passphrase, hexSeed1)
        const wallet2 = WalletUtil.fromSeededPassphrase(passphrase, hexSeed2)
        const wallet3 = WalletUtil.fromSeededPassphrase(passphrase, hexSeed3)
        const wallet4 = WalletUtil.fromSeededPassphrase(passphrase, hexSeed4)

        expect(wallet1.privateKey).to.not.eq(wallet2.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet1.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet3.privateKey)
        expect(wallet2.privateKey).to.not.eq(wallet4.privateKey)
        expect(wallet3.privateKey).to.not.eq(wallet4.privateKey)
    })

    it("Should error if the password is weak", () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        expect(() => WalletUtil.fromSeededPassphrase("", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("short", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("SHORT", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("1234", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("abcDEF", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("123abc", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("less-8", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("LESS-8", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("onlyHasLettersButNoNumbers", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("only-lowercase-and-1234", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("aBcD12", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("aBcD123", hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("@$%&_-!=/()", hexSeed)).to.throw()

        expect(() => WalletUtil.fromSeededPassphrase("aBcD1234", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("1234ABCabc", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("$symbols-SH@ULD-b3-0K", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("Str0nG-pass", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("1=GoodPass1234", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("N1ceStronG'pass", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("4passD0ntCrakM3", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("0141d6ab9sd7vn1387naPsSyv2v", hexSeed)).to.not.throw()
        expect(() => WalletUtil.fromSeededPassphrase("This is a long passphrase with 1 number", hexSeed)).to.not.throw()
    })

    it("Invalid values should error", () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"

        expect(() => WalletUtil.fromSeededPassphrase(1234 as any, hexSeed)).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("1234ABCabc", "invalid-seed")).to.throw()
        expect(() => WalletUtil.fromSeededPassphrase("1234ABCabc", 1234 as any)).to.throw()
    })

    it("Should sign correctly", async () => {
        const hexSeed = "0x54a8c0ab653c15bfb48b47fd011ba2b9617af01cb45cab344acd57c924d56798"
        const wallet = WalletUtil.fromSeededPassphrase("N1ceStronG'pass", hexSeed)

        const jsonBody = { "method": "getVisibility", "timestamp": 1582196988554 }

        const signature = await JsonSignature.sign(jsonBody, wallet)

        expect(JsonSignature.isValid(signature, utils.computePublicKey(wallet.publicKey, true), jsonBody)).to.be.true
        expect(JsonSignature.isValid(signature, wallet.publicKey, jsonBody)).to.be.true
    })
})

describe("Baby Jub wallets", () => {
    it("Should create a wallet from a private key", () => {
        const bytes = Random.getBytes(32)
        const wallet = new WalletBabyJub(bytes)

        expect(wallet.rawPrivateKey.toString("hex")).to.eq(bytes.toString("hex"))
    })
    it("Different process credentials should generate different wallets", () => {
        const wallet1 = WalletBabyJub.fromProcessCredentials(
            "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
            "secret1234"
        )
        const wallet2 = WalletBabyJub.fromProcessCredentials(
            "0x0123456789abcdef0123456789abcdef0123456789abcdef0000000000000000",
            "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
            "secret1234"
        )
        expect(wallet1.privateKey.toString()).to.not.eq(wallet2.privateKey.toString())

        const wallet3 = WalletBabyJub.fromProcessCredentials(
            "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
            "0x0123456789abcdef0123456789abcdef0123456789abcdef0000000000000000",
            "secret1234"
        )
        expect(wallet1.privateKey.toString()).to.not.eq(wallet3.privateKey.toString())

        const wallet4 = WalletBabyJub.fromProcessCredentials(
            "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
            "secretXXXXXXXXXXX"
        )
        expect(wallet1.privateKey.toString()).to.not.eq(wallet4.privateKey.toString())

        expect(wallet2.privateKey.toString()).to.not.eq(wallet3.privateKey.toString())
        expect(wallet2.privateKey.toString()).to.not.eq(wallet4.privateKey.toString())

        expect(wallet3.privateKey.toString()).to.not.eq(wallet4.privateKey.toString())
    })
    it("Should compute the raw private key seed from the process credentials", () => {
        const loginKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        const processId = "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"

        const inputs = [
            {
                chosenSecret: "1234ABCDE",
                rawPrivKey: "9b1f1f3bfded922b13eeec06dbb2e8716959a99c5c8980e6e645dc8e6ac3f3b0"
            },
            {
                chosenSecret: "&&QQ$$__",
                rawPrivKey: "e421a941f5120f57e0f48c75c3f78f0b0929ec138233cbf041b06a69d87cf597"
            },
            {
                chosenSecret: "verysupersecret",
                rawPrivKey: "c87289a9e47f863834896d8d8b81543946fb4a6acb3327b63959853e3ba7ba09"
            },
            {
                chosenSecret: "ULTRA_MAXI_SECRET",
                rawPrivKey: "87f9315f93abbd233915ed36f259030116276d1392c82b809e439ecc68a3b8b7"
            },
            {
                chosenSecret: "¡¡!!>>%%&&//",
                rawPrivKey: "781fef45a55374c91b5aa38baad5c0e711204f944aa690df11264a38b1ecc037"
            },
        ]

        for (let input of inputs) {
            const wallet = WalletBabyJub.fromProcessCredentials(loginKey, processId, input.chosenSecret)

            expect(wallet.rawPrivateKey.toString("hex")).to.eq(input.rawPrivKey)
        }
    })
    it("Should compute the raw private key from a hex seed", () => {
        const inputs = [
            {
                hexSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0313233344142434445",
                rawPrivKey: "9b1f1f3bfded922b13eeec06dbb2e8716959a99c5c8980e6e645dc8e6ac3f3b0"
            },
            {
                hexSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef02626515124245f5f",
                rawPrivKey: "e421a941f5120f57e0f48c75c3f78f0b0929ec138233cbf041b06a69d87cf597"
            },
            {
                hexSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0766572797375706572736563726574",
                rawPrivKey: "c87289a9e47f863834896d8d8b81543946fb4a6acb3327b63959853e3ba7ba09"
            },
            {
                hexSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0554c5452415f4d4158495f534543524554",
                rawPrivKey: "87f9315f93abbd233915ed36f259030116276d1392c82b809e439ecc68a3b8b7"
            },
            {
                hexSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0c2a1c2a121213e3e252526262f2f",
                rawPrivKey: "781fef45a55374c91b5aa38baad5c0e711204f944aa690df11264a38b1ecc037"
            },
        ]

        for (let input of inputs) {
            const wallet = WalletBabyJub.fromHexSeed(input.hexSeed)

            expect(wallet.rawPrivateKey.toString("hex")).to.eq(input.rawPrivKey)
        }
    })
    it("Should compute the hashed private key from the raw one", () => {
        const inputs = [
            {
                rawPrivKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                privKey: "5634430887631083315783016130888700067357795275280051593827143158352587490718"
            },
            {
                rawPrivKey: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
                privKey: "5035416475395287127593692370057652150855374392316196829321791977675687614178"
            },
            {
                rawPrivKey: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
                privKey: "5717535079455143168181896768413240376947313423579186859608937093206000190547"
            },
            {
                rawPrivKey: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
                privKey: "5369776774951030641578597209373721525835886482376591097000908090158561065268"
            },
            {
                rawPrivKey: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
                privKey: "3750943115417715871235750915600572657044180700843206948181226910723432259050"
            },
        ]

        for (let input of inputs) {
            const wallet = new WalletBabyJub(Buffer.from(input.rawPrivKey, "hex"))

            expect(wallet.privateKey.toString()).to.eq(input.privKey)
        }
    })
    it("Should compute the public key", () => {
        const inputs = [
            {
                privKeyRaw: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                publicKeyX: "2323089994540402667436267813647615201872748351902172515524901997531212743295",
                publicKeyY: "12317655903656189808902108314292684613443996443978066123499327472477140971830"
            },
            {
                privKeyRaw: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
                publicKeyX: "10089439652159546734026004209328805749776850425593957798667741832442400882926",
                publicKeyY: "3755252036227114241279240444589688678115297877423928328422601014356695629187"
            },
            {
                privKeyRaw: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
                publicKeyX: "17120495708971387007477740114456370921469534657857479844598149186276584098595",
                publicKeyY: "12824393295882528614933772576899234922918569258924896093321387513437132463825"
            },
            {
                privKeyRaw: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
                publicKeyX: "3315238466624336107387125028637262044377943677368832849703196075937163699906",
                publicKeyY: "3262696611888865709161255260522144710892494270582171052148591904572332270408"
            },
            {
                privKeyRaw: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
                publicKeyX: "14752665868550361413653971747835873002565201351734258741061948574869348120646",
                publicKeyY: "21874001471376184365557001817781623696205238827595814508057563991948599471721"
            },
            {
                privKeyRaw: "56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234",
                publicKeyX: "14895001608837730827630211511640434817187968071091990801669426869282562468606",
                publicKeyY: "17828625735398137034470752601318604873830635783776274359582838283512708840986"
            },
            {
                privKeyRaw: "6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345",
                publicKeyX: "2074025684570664775245207792075226400862912301651003065463018126633551060737",
                publicKeyY: "15475366310526542823527201123917166818326953421038487128351412320944027157157"
            },
            {
                privKeyRaw: "789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456",
                publicKeyX: "9035853622793797821764414778674241906869751845885694807901750764479471390531",
                publicKeyY: "15075282604104008848147228847863128923941531174265698899467929385500738660779"
            },
        ]

        for (let input of inputs) {
            const wallet = new WalletBabyJub(Buffer.from(input.privKeyRaw, "hex"))
            const { x, y } = wallet.publicKey

            expect(x.toString()).to.eq(input.publicKeyX)
            expect(y.toString()).to.eq(input.publicKeyY)
        }
    })

    it("Should sign messages", () => {
        const inputs = [
            {
                privKeyRaw: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                message: '{"some":"payload","here":1234}',
                r8_0: "4711369596374290853215714646560065330618168393684810851763468019036483848664",
                r8_1: "6799194344653405875603989695179231529256998914327214542258399145649981139221",
                s: "1315953122201904073661149466127323706950258151522489238862372783957785360699",
            },
            {
                privKeyRaw: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                message: '{"some":"text","there":true}',
                r8_0: "9834674187784696198735175549502459882027641788057216177666684071898963891077",
                r8_1: "19330356132450495241718398112462039731418675751633767184950211441741717723473",
                s: "1685516842082103670714026732838872606709462753587557004569115681564591291940",
            },
            {
                privKeyRaw: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
                message: '{"some":"payload","here":1234}',
                r8_0: "11201906067202338881810395438086633247168003068967347505865482745147267109808",
                r8_1: "16167025072819341905287312652545405667940570119579675081771569456985797353909",
                s: "1913232195615523510951765380907919922063295350254880010830822166873013646411",
            },
            {
                privKeyRaw: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
                message: '{"some":"text","there":true}',
                r8_0: "14220493707120184118333202995292481761899104180093222143775654604356054891186",
                r8_1: "1927951887417066915113927521548154013436115157856014139381368327690675703873",
                s: "1055130177526171532046777954174970482868312788964353018744334889340682018298",
            },
        ]

        for (let input of inputs) {
            const privK = Buffer.from(input.privKeyRaw, "hex")
            const msg = Buffer.from(input.message, "utf8")
            const wallet = new WalletBabyJub(privK)

            const sig = wallet.sign(msg)

            expect(sig.R8[0].toString()).to.eq(input.r8_0)
            expect(sig.R8[1].toString()).to.eq(input.r8_1)
            expect(sig.S.toString()).to.eq(input.s)

            const valid = WalletBabyJub.verify(msg, sig, wallet.publicKey)
            expect(valid).to.be.true
        }
    })
})
