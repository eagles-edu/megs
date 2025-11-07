import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as cheerio from "cheerio"
import { ensureInteractiveScaffold } from "../tools/expand-questions.mjs"

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sample legacy exercise</title>
  </head>
  <body>
    <article itemprop="articleBody">
      <h1>Legacy Exercise</h1>
      <div class="nn_sliders accordion panel-group" id="legacy-set-1">
        <span class="anchor nn_sliders-scroll"></span>
        <div class="accordion-group panel nn_sliders-group">
          <span class="anchor nn_sliders-scroll"></span>
          <div class="accordion-heading panel-heading">
            <a class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" href="#legacy-q1">
              <span class="nn_sliders-toggle-inner">1. Question one?</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="legacy-q1" aria-hidden="true">
            <div class="accordion-inner panel-body">
              <h2 class="nn_sliders-title">1. Question one?</h2>
              <p>
                The answer is <span class="in-text-decoration-underline__14j0pz">example</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="nn_sliders accordion panel-group" id="legacy-set-2">
        <span class="anchor nn_sliders-scroll"></span>
        <div class="accordion-group panel nn_sliders-group">
          <span class="anchor nn_sliders-scroll"></span>
          <div class="accordion-heading panel-heading">
            <a class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" href="#legacy-q2">
              <span class="nn_sliders-toggle-inner">2. Question two?</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="legacy-q2" aria-hidden="true">
            <div class="accordion-inner panel-body">
              <h2 class="nn_sliders-title">2. Question two?</h2>
              <p>
                Another answer is <span class="in-text-decoration-underline__14j0pz">sample</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <p>Trailing content.</p>
    </article>
  </body>
</html>`

describe("ensureInteractiveScaffold", () => {
  it("wraps legacy accordions in the canonical exercise form", async () => {
    const result = await ensureInteractiveScaffold(SAMPLE_HTML, "sample.html")
    assert.equal(result.converted, true)
    assert.equal(result.addedQuestions, 2)

    const $ = cheerio.load(result.html, { decodeEntities: false })
    const $form = $("form.exercise-form[data-exercise-form]").first()
    assert.ok($form.length, "form scaffold should exist")
    assert.equal($form.attr("data-storage-key"), "exercise-sample")
    assert.equal($form.attr("data-exercise-question-count"), "2")

    const progressText = $form.find("[data-exercise-progress]").first().text().trim()
    assert.equal(progressText, "0 of 2 questions completed.")

    const $questions = $form.find("[data-exercise-question]")
    assert.equal($questions.length, 2)
    $questions.each((idx, el) => {
      const expectedIndex = idx + 1
      const $quest = $(el)
      assert.equal($quest.attr("data-exercise-question"), String(expectedIndex))
      const $progress = $quest.find("[data-exercise-question-progress]").first()
      assert.ok($progress.length, "question progress markup should exist")
      assert.equal($progress.attr("data-item"), String(expectedIndex))
      assert.equal($progress.attr("data-total"), "2")
      assert.equal($progress.text().trim(), `Question ${expectedIndex} of 2`)
      const inputCount = $quest.find(".exercise-response-input").length
      assert.ok(inputCount >= 1, "response inputs should be present")
    })

    const trailing = $("article p").last().text().trim()
    assert.equal(trailing, "Trailing content.")
  })
})
