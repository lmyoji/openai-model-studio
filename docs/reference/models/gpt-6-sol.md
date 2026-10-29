# GPT-6 Sol

- Model ID: gpt-6-sol
- Model type: reasoning
- Current snapshot: gpt-6-sol

Built to power complex coding and agentic workflows.

GPT-6 Sol is built for complex coding and agentic workflows.
See [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) for the newer Sol model.

`reasoning.effort` supports `none`, `low`, `medium` (default), `high`, `xhigh`, and `max`.
Use the Responses API for built-in tools and function calling. Chat Completions supports function calling only with `reasoning_effort` set to `none`.

EU data residency is available with Standard, Flex, and Batch processing. EU data residency is not available with Fast processing.
See [data residency eligibility](https://developers.openai.com/api/docs/guides/your-data#which-models-and-features-are-eligible-for-data-residency).

## Snapshots
- gpt-6-sol

## Current snapshot details
- Context window: 1,050,000 tokens
- Max input: 922,000 tokens
- Max output: 128,000 tokens
- Knowledge cutoff: 2026-04-20
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses, chat_completions, batch
- Supported features: streaming, structured_outputs, function_calling, file_search, image_input, web_search, prompt_caching

## Supported tools
- web_search
- file_search
- image_generation
- code_interpreter
- hosted_shell
- apply_patch
- skills
- computer_use
- mcp
- tool_search

## Pricing notes
- Cached input tokens are priced at 10% of the uncached input token rate.
- Cache writes are billed at 1.25x the uncached input token rate.
- Prompts with more than 272K input tokens are priced at 2x input and cache rates and 1.5x output for the full request.
- Regional processing adds a 10% premium where available.
- Batch and Flex are priced at 50% of Standard rates. Fast mode is priced at 2x the applicable rates.

Playground: https://platform.openai.com/chat/edit?models=gpt-6-sol


