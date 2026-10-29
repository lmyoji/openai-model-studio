# GPT-5 Pro

- Model ID: gpt-5-pro
- Model type: reasoning
- Current snapshot: gpt-5-pro-2025-10-06

Version of GPT-5 that produces smarter and more precise responses

GPT-5 Pro uses more compute to think harder and provide consistently better answers.

 GPT-5 Pro is available in the [Responses API only](https://developers.openai.com/api/docs/api-reference/responses)
 to enable support for multi-turn model interactions before responding to API
 requests, and other advanced API features in the future. Since GPT-5 Pro is designed
 to tackle tough problems, some requests may take several minutes to finish.
 To avoid timeouts, try using [background mode](https://developers.openai.com/api/docs/guides/background). 
 As our most advanced reasoning model, GPT-5 Pro defaults to (and only supports) `reasoning.effort: high`.
 GPT-5 Pro does not support code interpreter.

## Snapshots
- gpt-5-pro-2025-10-06

## Current snapshot details
- Context window: 400,000 tokens
- Max output: 272,000 tokens
- Knowledge cutoff: 2024-09-30
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses, batch
- Supported features: streaming, structured_outputs, function_calling, file_search, file_uploads, image_input, web_search

## Supported tools
- function_calling
- file_search
- image_generation
- mcp
- web_search

Playground: https://platform.openai.com/chat/edit?models=gpt-5-pro


