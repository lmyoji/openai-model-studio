# GPT-5.5 Pro

- Model ID: gpt-5.5-pro
- Model type: reasoning
- Current snapshot: gpt-5.5-pro-2026-04-23

Version of GPT-5.5 that produces smarter and more precise responses.

GPT-5.5 Pro uses more compute to think harder and provide consistently better answers.

GPT-5.5 Pro is available for Responses API requests, including through the Batch API, to enable support for multi-turn model interactions before responding to API requests and other advanced API features in the future. Since GPT-5.5 Pro is designed to tackle tough problems, some requests may take several minutes to finish. To avoid timeouts, try using [background mode](https://developers.openai.com/api/docs/guides/background). Reasoning.effort supports: medium, high (default) and xhigh.

## Snapshots
- gpt-5.5-pro-2026-04-23

## Current snapshot details
- Context window: 1,050,000 tokens
- Max output: 128,000 tokens
- Knowledge cutoff: 2025-12-01
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses, batch
- Supported features: structured_outputs, function_calling, file_search, image_input, image_generation, mcp, web_search

## Supported tools
- function_calling
- web_search
- file_search
- image_generation
- code_interpreter
- hosted_shell
- mcp

## Pricing notes
- GPT-5.5 Pro does not offer a cached input discount.
- Regional processing (data residency) endpoints are charged a 10% uplift for GPT-5.5 Pro.

Playground: https://platform.openai.com/chat/edit?models=gpt-5.5-pro


