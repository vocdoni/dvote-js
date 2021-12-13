import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { ProcessMetadata, ProcessMetadataTemplate, VochainProcessStatus } from "@vocdoni/data-models"
import { RawResults, Voting } from "../../src"

addCompletionHooks()

describe("Results", () => {
  it("Should aggregate single choice results (zip)", () => {
    // 1
    const meta: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    meta.questions = [
      {
        choices: [{ title: { default: "Should be 10" }, value: 0 }, { title: { default: "Should be 20" }, value: 1 }, { title: { default: "Should be 30" }, value: 2 }],
        title: { default: "Q1" },
        description: { default: "Desc" }
      }
    ]
    const rawResults: RawResults = {
      results: [["10", "20", "30"]],
      status: VochainProcessStatus.READY,
      envelopHeight: 1234
    }

    const digestedResults = Voting.digestSingleChoiceResults(rawResults, meta)
    expect(digestedResults.totalVotes).to.eq(rawResults.envelopHeight)
    expect(digestedResults.questions.length).to.eq(1)
    expect(digestedResults.questions[0].title).to.deep.eq(meta.questions[0].title)
    expect(digestedResults.questions[0].voteResults.length).to.eq(3)
    expect(digestedResults.questions[0].voteResults[0].title).to.deep.eq(meta.questions[0].choices[0].title)
    expect(digestedResults.questions[0].voteResults[0].votes.toString()).to.eq(rawResults.results[0][0])
    expect(digestedResults.questions[0].voteResults[1].votes.toString()).to.eq(rawResults.results[0][1])
    expect(digestedResults.questions[0].voteResults[2].votes.toString()).to.eq(rawResults.results[0][2])

    // 2
    const meta2: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    meta2.questions = [
      {
        choices: [{ title: { default: "Should be 100" }, value: 0 }, { title: { default: "Should be 200" }, value: 1 }, { title: { default: "Should be 300" }, value: 2 }],
        title: { default: "Q1" },
        description: { default: "Desc" }
      },
      {
        choices: [{ title: { default: "Should be 400" }, value: 0 }, { title: { default: "Should be 500" }, value: 1 }, { title: { default: "Should be 600" }, value: 2 }],
        title: { default: "Q2" },
        description: { default: "Desc" }
      }
    ]
    const rawResults2: RawResults = {
      results: [["100", "200", "300"], ["400", "500", "600"]],
      status: VochainProcessStatus.READY,
      envelopHeight: 2345
    }

    const digestedResults2 = Voting.digestSingleChoiceResults(rawResults2, meta2)
    expect(digestedResults2.totalVotes).to.eq(rawResults2.envelopHeight)
    expect(digestedResults2.questions.length).to.eq(2)
    expect(digestedResults2.questions[0].title).to.deep.eq(meta2.questions[0].title)
    expect(digestedResults2.questions[0].voteResults.length).to.eq(3)
    expect(digestedResults2.questions[0].voteResults[0].title).to.deep.eq(meta2.questions[0].choices[0].title)
    expect(digestedResults2.questions[0].voteResults[0].votes.toString()).to.eq(rawResults2.results[0][0])
    expect(digestedResults2.questions[0].voteResults[1].votes.toString()).to.eq(rawResults2.results[0][1])
    expect(digestedResults2.questions[0].voteResults[2].votes.toString()).to.eq(rawResults2.results[0][2])

    expect(digestedResults2.questions[1].title).to.deep.eq(meta2.questions[1].title)
    expect(digestedResults2.questions[1].voteResults.length).to.eq(3)
    expect(digestedResults2.questions[1].voteResults[0].title).to.deep.eq(meta2.questions[1].choices[0].title)
    expect(digestedResults2.questions[1].voteResults[0].votes.toString()).to.eq(rawResults2.results[1][0])
    expect(digestedResults2.questions[1].voteResults[1].votes.toString()).to.eq(rawResults2.results[1][1])
    expect(digestedResults2.questions[1].voteResults[2].votes.toString()).to.eq(rawResults2.results[1][2])

  })

  it("Should aggregate single question results (weighted index)", () => {
    // 1
    const meta: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    meta.questions = [
      {
        choices: [{ title: { default: "AA" }, value: 0 }, { title: { default: "BB" }, value: 1 }],
        title: { default: "Q1" },
        description: { default: "Desc" }
      }
    ]
    const rawResults: RawResults = {
      results: [["0", "0", "3"], ["0", "10", "0"]],
      status: VochainProcessStatus.READY,
      envelopHeight: 1234
    }

    const digestedResults = Voting.digestSingleQuestionResults(rawResults, meta)
    expect(digestedResults.totalVotes).to.eq(rawResults.envelopHeight)
    expect(digestedResults.options.length).to.eq(rawResults.results.length)
    expect(digestedResults.title).to.deep.eq(meta.questions[0].title)
    expect(digestedResults.options[0].title).to.deep.eq(meta.questions[0].choices[0].title)
    expect(digestedResults.options[0].votes.toString()).to.eq("6")
    expect(digestedResults.options[1].title).to.deep.eq(meta.questions[0].choices[1].title)
    expect(digestedResults.options[1].votes.toString()).to.eq("10")

    // 2
    const meta2: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    meta2.questions = [
      {
        choices: [
          { title: { default: "AAAA" }, value: 0 },
          { title: { default: "BBBB" }, value: 1 },
          { title: { default: "CCCC" }, value: 2 },
          { title: { default: "DDDD" }, value: 3 }
        ],
        title: { default: "Q11" },
        description: { default: "Desc" }
      }
    ]
    const rawResults2: RawResults = {
      results: [["3", "0", "0"], ["2", "1", "0"], ["0", "0", "3"], ["0", "0", "1000000000000000000000000000000000"]],
      status: VochainProcessStatus.READY,
      envelopHeight: 2345
    }

    const digestedResults2 = Voting.digestSingleQuestionResults(rawResults2, meta2)
    expect(digestedResults2.totalVotes).to.eq(rawResults2.envelopHeight)
    expect(digestedResults2.options.length).to.eq(rawResults2.results.length)
    expect(digestedResults2.title).to.deep.eq(meta2.questions[0].title)
    expect(digestedResults2.options[0].title).to.deep.eq(meta2.questions[0].choices[0].title)
    expect(digestedResults2.options[0].votes.toString()).to.eq("0")
    expect(digestedResults2.options[1].title).to.deep.eq(meta2.questions[0].choices[1].title)
    expect(digestedResults2.options[1].votes.toString()).to.eq("1")
    expect(digestedResults2.options[2].title).to.deep.eq(meta2.questions[0].choices[2].title)
    expect(digestedResults2.options[2].votes.toString()).to.eq("6")
    expect(digestedResults2.options[3].title).to.deep.eq(meta2.questions[0].choices[3].title)
    expect(digestedResults2.options[3].votes.toString()).to.eq("2000000000000000000000000000000000")

    // 3
    const meta3: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    meta3.questions = [
      {
        choices: [
          { title: { default: "AAAAA" }, value: 0 },
          { title: { default: "BBBBB" }, value: 1 },
          { title: { default: "CCCCC" }, value: 2 },
          { title: { default: "DDDDD" }, value: 3 }
        ],
        title: { default: "Q111" },
        description: { default: "Desc" }
      }
    ]
    const rawResults3: RawResults = {
      results: [["3", "0", "0", "10"], ["10000000", "1000000000000000000000000000000000", "0", "0"], ["0", "0", "5000000000000000000000000000000000"], ["5000", "0", "0", "1"]],
      status: VochainProcessStatus.READY,
      envelopHeight: 3456
    }

    const digestedResults3 = Voting.digestSingleQuestionResults(rawResults3, meta3)
    expect(digestedResults3.totalVotes).to.eq(rawResults3.envelopHeight)
    expect(digestedResults3.options.length).to.eq(rawResults3.results.length)
    expect(digestedResults3.title).to.deep.eq(meta3.questions[0].title)
    expect(digestedResults3.options[0].title).to.deep.eq(meta3.questions[0].choices[0].title)
    expect(digestedResults3.options[0].votes.toString()).to.eq("30")
    expect(digestedResults3.options[1].title).to.deep.eq(meta3.questions[0].choices[1].title)
    expect(digestedResults3.options[1].votes.toString()).to.eq("1000000000000000000000000000000000")
    expect(digestedResults3.options[2].title).to.deep.eq(meta3.questions[0].choices[2].title)
    expect(digestedResults3.options[2].votes.toString()).to.eq("10000000000000000000000000000000000")
    expect(digestedResults3.options[3].title).to.deep.eq(meta3.questions[0].choices[3].title)
    expect(digestedResults3.options[3].votes.toString()).to.eq("3")
  })
})
