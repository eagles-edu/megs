/* Gate exercise accordions behind correct answers and collect submissions */
(function () {
  "use strict"

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn)
    else fn()
  }

  function toArray(list) {
    if (!list) return []
    return Array.prototype.slice.call(list)
  }

  function normalizeAnswer(value) {
    if (!value) return ""
    var text = String(value).toLowerCase()
    text = text.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    text = text.replace(/[^a-z0-9\s'-]/g, " ")
    text = text.replace(/-/g, " ")
    text = text.replace(/[\s\u00a0]+/g, " ")
    return text.trim()
  }

  function parseConfig(script) {
    if (!script) return {}
    var raw = script.textContent || script.innerText || ""
    if (!raw) return {}
    try {
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return {}
      if (!parsed.recipients || !Array.isArray(parsed.recipients)) parsed.recipients = []
      return parsed
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("exercise-gate: unable to parse config", err)
      }
      return {}
    }
  }

  function readStoredAttempt(key) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null
      var raw = window.localStorage.getItem(key)
      if (!raw) return null
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return null
      return parsed
    } catch {
      return null
    }
  }

  function writeStoredAttempt(key, data) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return
      window.localStorage.setItem(key, JSON.stringify(data))
    } catch {
      /* storage disabled */
    }
  }

  function formatTimestamp(timestamp) {
    var date = new Date(timestamp)
    if (isNaN(date.getTime())) return ""
    try {
      return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    } catch {
      try {
        return date.toLocaleString()
      } catch {
        return date.toISOString()
      }
    }
  }

  ready(function () {
    var form = document.querySelector("[data-exercise-form]")
    if (!form) return

    var emailInput = form.querySelector("[data-exercise-email]")
    var studentIdInput = form.querySelector("[data-exercise-student-id]")
    var submitRow = form.querySelector("[data-exercise-submit-row]")
    var submitButton = form.querySelector("[data-exercise-submit]")
    var progressEl = form.querySelector("[data-exercise-progress]")
    var feedbackEl = form.querySelector("[data-exercise-feedback]")
    var lastAttemptEl = form.querySelector("[data-exercise-last-attempt]")
    var storageKey = "exercise-progress:" + (form.getAttribute("data-storage-key") || "default")
    var config = parseConfig(document.querySelector("[data-exercise-config]"))
    if (!config.recipients) config.recipients = []

    var questionNodes = toArray(form.querySelectorAll("[data-exercise-question]"))
    var questions = []

    for (var i = 0; i < questionNodes.length; i++) {
      var node = questionNodes[i]
      var toggle = node.querySelector(".nn_sliders-toggle")
      var row = node.querySelector(".exercise-response-row")
      var inputs = toArray(node.querySelectorAll(".exercise-response-input"))
      var answers = []
      var panel = null
      if (toggle) {
        var controlId = toggle.getAttribute("aria-controls") || toggle.getAttribute("data-id") || ""
        if (controlId) panel = document.getElementById(controlId)
      }
      if (panel) {
        var spans = panel.querySelectorAll(".in-text-decoration-underline__14j0pz")
        for (var s = 0; s < spans.length; s++) {
          var text = normalizeAnswer(spans[s].textContent || spans[s].innerText || "")
          if (text) answers.push(text)
        }
      }
      questions.push({
        id: String(node.getAttribute("data-exercise-question") || i + 1),
        node: node,
        toggle: toggle,
        row: row,
        panel: panel,
        inputs: inputs,
        answers: answers,
        complete: false,
        flashTimer: null,
      })
    }

    var totalQuestions = questions.length

    function clearFeedback() {
      if (!feedbackEl) return
      feedbackEl.textContent = ""
      feedbackEl.classList.remove(
        "exercise-form__feedback--error",
        "exercise-form__feedback--success"
      )
    }

    function setFeedback(message, type) {
      if (!feedbackEl) return
      feedbackEl.textContent = message || ""
      feedbackEl.classList.remove(
        "exercise-form__feedback--error",
        "exercise-form__feedback--success"
      )
      if (!message) return
      if (type === "error") feedbackEl.classList.add("exercise-form__feedback--error")
      else if (type === "success") feedbackEl.classList.add("exercise-form__feedback--success")
    }

    function renderLastAttempt(data) {
      if (!lastAttemptEl) return
      while (lastAttemptEl.firstChild) lastAttemptEl.removeChild(lastAttemptEl.firstChild)
      if (!data || !data.timestamp) {
        lastAttemptEl.setAttribute("hidden", "hidden")
        return
      }
      var formatted = formatTimestamp(data.timestamp)
      if (!formatted) {
        lastAttemptEl.setAttribute("hidden", "hidden")
        return
      }
      lastAttemptEl.removeAttribute("hidden")
      lastAttemptEl.appendChild(document.createTextNode("Last submission: " + formatted + " "))
      var icon = document.createElement("span")
      icon.className = "exercise-form__last-attempt-icon"
      icon.setAttribute("aria-hidden", "true")
      icon.textContent = "✅"
      lastAttemptEl.appendChild(icon)
      if (emailInput && data.email && !emailInput.value) {
        emailInput.value = data.email
      }
      if (studentIdInput && data.studentId && !studentIdInput.value) {
        studentIdInput.value = data.studentId
      }
    }

    function isEmailValid() {
      if (!emailInput) return true
      var value = (emailInput.value || "").trim()
      if (!value) return false
      if (typeof emailInput.checkValidity === "function") {
        return emailInput.checkValidity()
      }
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
    }

    function isStudentIdValid() {
      if (!studentIdInput) return true
      var value = (studentIdInput.value || "").trim()
      if (!value) return false
      if (typeof studentIdInput.checkValidity === "function") {
        try {
          return studentIdInput.checkValidity()
        } catch {
          /* fallback below */
        }
      }
      return /^[a-z]+\d{3}$/.test(value)
    }

    function ensureEmail() {
      if (isEmailValid()) return true
      setFeedback("Enter a valid email address before checking answers.", "error")
      if (emailInput) {
        emailInput.classList.add("exercise-form__email-input--invalid")
        emailInput.focus()
      }
      return false
    }

    function ensureStudentId() {
      if (isStudentIdValid()) return true
      setFeedback(
        "Enter your student ID using lowercase letters followed by three digits (example: abc123) before checking answers.",
        "error"
      )
      if (studentIdInput) {
        studentIdInput.classList.add("exercise-form__email-input--invalid")
        studentIdInput.focus()
      }
      return false
    }

    function ensureContactInfo() {
      if (!ensureEmail()) return false
      return ensureStudentId()
    }

    function allQuestionsComplete() {
      if (!questions.length) return false
      for (var i = 0; i < questions.length; i++) {
        if (!questions[i].complete) return false
      }
      return true
    }

    function updateSubmitState() {
      if (!submitButton) return
      var ready = allQuestionsComplete() && isEmailValid() && isStudentIdValid()
      if (submitRow && submitRow.hasAttribute("hidden")) ready = false
      submitButton.disabled = !ready
      submitButton.setAttribute("aria-disabled", ready ? "false" : "true")
    }

    function updateProgress() {
      if (!progressEl) return
      var count = 0
      for (var i = 0; i < questions.length; i++) {
        if (questions[i].complete) count++
      }
      progressEl.textContent = count + " of " + totalQuestions + " questions completed."
      if (submitRow) {
        if (count === totalQuestions) submitRow.removeAttribute("hidden")
        else submitRow.setAttribute("hidden", "hidden")
      }
      updateSubmitState()
    }

    function clearTimer(question) {
      if (question.flashTimer) {
        clearTimeout(question.flashTimer)
        question.flashTimer = null
      }
    }

    function markQuestionIncorrect(question) {
      if (!question) return
      clearTimer(question)
      question.complete = false
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--correct",
          "exercise-response-row--flash-success"
        )
        question.row.classList.add(
          "exercise-response-row--incorrect",
          "exercise-response-row--flash-error"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = false
        input.removeAttribute("aria-readonly")
        input.classList.remove("exercise-response-input--locked")
      }
      question.flashTimer = setTimeout(function () {
        if (question.row) question.row.classList.remove("exercise-response-row--flash-error")
      }, 5000)
    }

    function markQuestionCorrect(question) {
      if (!question) return false
      clearTimer(question)
      question.complete = true
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--incorrect",
          "exercise-response-row--flash-error"
        )
        question.row.classList.add(
          "exercise-response-row--correct",
          "exercise-response-row--flash-success"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = true
        input.setAttribute("aria-readonly", "true")
        input.classList.add("exercise-response-input--locked")
      }
      question.flashTimer = setTimeout(function () {
        if (question.row) question.row.classList.remove("exercise-response-row--flash-success")
      }, 5000)
      return true
    }

    function evaluateQuestion(question) {
      var expected = question.answers.slice()
      var requiredCount = expected.length
      var filled = []
      for (var i = 0; i < question.inputs.length; i++) {
        var raw = question.inputs[i].value
        var normalized = normalizeAnswer(raw)
        if (normalized) filled.push(normalized)
      }
      if (!requiredCount) {
        return { ready: filled.length > 0, correct: filled.length > 0 }
      }
      if (filled.length < requiredCount) return { ready: false, correct: false }
      if (filled.length > requiredCount) return { ready: true, correct: false }
      var remaining = expected.slice()
      for (var a = 0; a < filled.length; a++) {
        var value = filled[a]
        var index = -1
        for (var r = 0; r < remaining.length; r++) {
          if (remaining[r] === value) {
            index = r
            break
          }
        }
        if (index === -1) return { ready: true, correct: false }
        remaining.splice(index, 1)
      }
      return { ready: true, correct: remaining.length === 0 }
    }

    function guardQuestion(question) {
      if (!question) return true
      if (question.complete) return true
      if (!ensureContactInfo()) return false
      var result = evaluateQuestion(question)
      if (!result.ready) {
        markQuestionIncorrect(question)
        setFeedback("Question " + question.id + ": fill in every answer before checking.", "error")
        updateSubmitState()
        return false
      }
      if (!result.correct) {
        markQuestionIncorrect(question)
        setFeedback("Question " + question.id + ": at least one noun is incorrect.", "error")
        updateSubmitState()
        return false
      }
      markQuestionCorrect(question)
      setFeedback("Question " + question.id + " unlocked!", "success")
      updateProgress()
      return true
    }

    function onToggleClick(event) {
      var toggle = event.currentTarget
      var question = toggle ? toggle._exerciseQuestion : null
      var allowed = guardQuestion(question)
      if (!allowed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
        return false
      }
      return true
    }

    function onToggleKeydown(event) {
      var key = event.key || event.code
      if (key === " ") key = "Space"
      if (key === "Spacebar") key = "Space"
      if (key !== "Enter" && key !== "Space") return
      var toggle = event.currentTarget
      var question = toggle ? toggle._exerciseQuestion : null
      var allowed = guardQuestion(question)
      if (!allowed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
        return false
      }
      return true
    }

    function attachGuards() {
      for (var i = 0; i < questions.length; i++) {
        var question = questions[i]
        if (!question.toggle) continue
        question.toggle._exerciseQuestion = question
        question.toggle.addEventListener("click", onToggleClick, true)
        question.toggle.addEventListener("keydown", onToggleKeydown, true)
      }
    }

    function closePanel(question) {
      if (!question || !question.panel) return
      question.panel.classList.remove("in", "show")
      question.panel.classList.add("collapse")
      question.panel.style.height = "0px"
      question.panel.style.display = ""
      question.panel.setAttribute("aria-hidden", "true")
      if (question.toggle) question.toggle.setAttribute("aria-expanded", "false")
    }

    function resetQuestion(question) {
      clearTimer(question)
      question.complete = false
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--correct",
          "exercise-response-row--incorrect",
          "exercise-response-row--flash-success",
          "exercise-response-row--flash-error"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = false
        input.removeAttribute("aria-readonly")
        input.classList.remove("exercise-response-input--locked")
        input.value = ""
      }
      closePanel(question)
    }

    function resetExercise() {
      for (var i = 0; i < questions.length; i++) resetQuestion(questions[i])
      updateProgress()
      clearFeedback()
      updateSubmitState()
    }

    function collectPayload() {
      var answersPayload = []
      for (var i = 0; i < questions.length; i++) {
        var question = questions[i]
        var values = []
        for (var j = 0; j < question.inputs.length; j++) {
          values.push(question.inputs[j].value || "")
        }
        answersPayload.push({ id: question.id, answers: values })
      }
      return {
        email: emailInput ? (emailInput.value || "").trim() : "",
        studentId: studentIdInput ? (studentIdInput.value || "").trim() : "",
        pageTitle: document.title,
        completedAt: new Date().toISOString(),
        recipients: config.recipients.slice(),
        answers: answersPayload,
      }
    }

    function sendSubmission(payload) {
      if (!config.submitUrl) return Promise.resolve()
      if (window.fetch) {
        return window
          .fetch(config.submitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          .then(function (response) {
            if (!response.ok) throw new Error("Submission failed")
            return response
          })
      }
      return new Promise(function (resolve, reject) {
        try {
          var xhr = new XMLHttpRequest()
          xhr.open("POST", config.submitUrl, true)
          xhr.setRequestHeader("Content-Type", "application/json")
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText)
            else reject(new Error("Submission failed"))
          }
          xhr.onerror = function () {
            reject(new Error("Submission failed"))
          }
          xhr.send(JSON.stringify(payload))
        } catch (err) {
          reject(err)
        }
      })
    }

    function handleSubmit(event) {
      event.preventDefault()
      if (!allQuestionsComplete()) {
        setFeedback("Finish every question before submitting.", "error")
        return false
      }
      if (!ensureContactInfo()) return false
      if (submitButton) submitButton.disabled = true
      var payload = collectPayload()
      setFeedback("Submitting answers...", "success")
      return sendSubmission(payload)
        .then(function () {
          var stored = {
            timestamp: Date.now(),
            email: payload.email,
            studentId: payload.studentId,
            answers: payload.answers,
          }
          writeStoredAttempt(storageKey, stored)
          renderLastAttempt(stored)
          resetExercise()
          setFeedback(
            "All answers submitted successfully. Answers have been cleared for your next attempt.",
            "success"
          )
          updateSubmitState()
          return true
        })
        .catch(function () {
          setFeedback("We could not submit your answers. Please try again.", "error")
          updateSubmitState()
          return false
        })
    }

    var storedAttempt = readStoredAttempt(storageKey)
    renderLastAttempt(storedAttempt)
    attachGuards()
    updateProgress()
    clearFeedback()
    updateSubmitState()

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        emailInput.classList.remove("exercise-form__email-input--invalid")
        updateSubmitState()
      })
      emailInput.addEventListener("blur", function () {
        if (isEmailValid()) emailInput.classList.remove("exercise-form__email-input--invalid")
      })
    }

    if (studentIdInput) {
      studentIdInput.addEventListener("input", function () {
        studentIdInput.classList.remove("exercise-form__email-input--invalid")
        updateSubmitState()
      })

      studentIdInput.addEventListener("blur", function () {
        if (isStudentIdValid())
          studentIdInput.classList.remove("exercise-form__email-input--invalid")
      })
    }

    form.addEventListener("submit", function (event) {
      handleSubmit(event)
    })
  })
})()
