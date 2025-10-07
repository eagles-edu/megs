+30
-0

# Issue summarization workflow setup

This repository includes a GitHub Actions workflow (`.github/workflows/summary.yml`) that automatically posts a one-paragraph summary whenever a new issue is opened. Follow the checklist below to make sure the automation works reliably.

## Prerequisites

1. **Enable GitHub Actions for the repository.**
   - Settings ▸ Actions ▸ General ▸ Allow "GitHub Actions".
2. **Confirm access to GitHub Models (beta) or GitHub Copilot enterprise features.**
   - The `actions/ai-inference@v1` action calls the hosted `gpt-4.1-mini` model. Verify that your organization or repository has model access under Settings ▸ Actions ▸ General ▸ "Models".
3. **No additional packages or runners are required.**
   - The workflow runs entirely on `ubuntu-22.04` hosted runners, and all dependencies are provided by the action itself.

## Required permissions

The workflow already declares the minimal permissions it needs:

- `issues: write` allows the job to post the summary comment with the provided `GITHUB_TOKEN`.
- `models: read` grants access to the hosted model endpoint.
- `contents: read` lets the action fetch workflow files and metadata.

Make sure the repository default permissions (Settings ▸ Actions ▸ General ▸ "Workflow permissions") allow "Read and write permissions", or override them for this workflow if your policy is more restrictive.

## Usage notes

- **Triggering:** The workflow responds to newly opened issues. If you want to re-run it on demand, use "Re-run all jobs" from the Actions run details after editing the issue content.
- **Failure handling:** If the AI call fails or returns no summary, the job stops with a clear error so you can investigate from the Actions logs.
- **Extensibility:** To customize the prompt, adjust the `input` payload in the AI inference step. You can also add routing logic—such as labels or templates—by inserting additional steps before the comment is created.

No further CI integration is required; the job is scoped exclusively to issue events so it won't slow down pull-request or push pipelines.