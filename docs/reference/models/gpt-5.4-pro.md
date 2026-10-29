# GPT-5.4 Pro

- Model ID: gpt-5.4-pro
- Model type: reasoning
- Current snapshot: gpt-5.4-pro-2026-03-05

Version of GPT-5.4 that produces smarter and more precise responses.

GPT-5.4 Pro uses more compute to think harder and provide consistently better answers.

GPT-5.4 Pro is available in the Responses API only to enable support for multi-turn model interactions before responding to API requests, and other advanced API features in the future. Since GPT-5.4 Pro is designed to tackle tough problems, some requests may take several minutes to finish. To avoid timeouts, try using [background mode](https://developers.openai.com/api/docs/guides/background). Reasoning.effort supports: medium (default), high and xhigh.

## Snapshots
- gpt-5.4-pro-2026-03-05

## Current snapshot details
- Context window: 1,050,000 tokens
- Max output: 128,000 tokens
- Knowledge cutoff: 2025-08-31
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses
- Supported features: streaming, function_calling, file_search, image_input, image_generation, mcp, web_search

## Supported tools
- function_calling
- web_search
- file_search
- tool_search
- image_generation
- apply_patch
- computer_use
- mcp

## Pricing notes
- For models with a 1.05M context window (GPT-5.4 and GPT-5.4 Pro), prompts with >272K input tokens are priced at 2x input and 1.5x output for the full session for standard, batch, and flex.
- Regional processing (data residency) endpoints are charged a 10% uplift for GPT-5.4 and GPT-5.4 Pro.

Playground: https://platform.openai.com/chat/edit?models=gpt-5.4-pro


