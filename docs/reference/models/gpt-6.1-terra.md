# GPT-6.1 Terra

- Model ID: gpt-6.1-terra
- Model type: reasoning
- Current snapshot: gpt-6.1-terra

A fast, efficient model for visual reasoning, precise computer use, and clear, natural writing.

Use GPT-6.1 Terra to match product photos to catalog entries, interpret
technical drawings, act on application screens, or draft and revise text.

`reasoning.effort` supports `none`, `low`, `medium` (default), `high`,
`xhigh`, and `max`.

Tool calling requires the Responses API.

See the [GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra#gpt-61-terra)
for prompting and migration guidance.

## Snapshots
- gpt-6.1-terra

## Current snapshot details
- Context window: 1,050,000 tokens
- Max input: 922,000 tokens
- Max output: 128,000 tokens
- Knowledge cutoff: 2026-06-01
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
- Cached input tokens are priced at 5% of the uncached input token rate.
- Cache-write prices shown use 30-minute retention. Standard cache writes cost $1.25 per million tokens for 30-minute retention and $2.50 for 12-hour retention, before long-context adjustments.
- Prompts with more than 272K input tokens are priced at 2x input and cache rates and 1.5x output for the full request.
- Batch and Flex prices are 50% lower than Standard.
- Regional processing adds a 10% premium where available.
- Fast mode prices are 2x Standard.

Playground: https://platform.openai.com/chat/edit?models=gpt-6.1-terra


