# o3-pro

- Model ID: o3-pro
- Model type: reasoning
- Current snapshot: o3-pro-2025-06-10

Version of o3 with more compute for better responses

The o-series of models are trained with reinforcement learning to think 
before they answer and perform complex reasoning. The o3-pro model uses more 
compute to think harder and provide consistently better answers.

o3-pro is available in the [Responses API only](https://developers.openai.com/api/docs/api-reference/responses)
to enable support for multi-turn model interactions before responding to API 
requests, and other advanced API features in the future. Since o3-pro is designed 
to tackle tough problems, some requests may take several minutes to finish. 
To avoid timeouts, try using [background mode](https://developers.openai.com/api/docs/guides/background).

## Snapshots
- o3-pro-2025-06-10

## Current snapshot details
- Context window: 200,000 tokens
- Max output: 100,000 tokens
- Knowledge cutoff: 2024-06-01
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses, batch
- Supported features: structured_outputs, function_calling, image_input

## Supported tools
- function_calling
- file_search
- image_generation
- mcp
- web_search

Playground: https://platform.openai.com/chat/edit?models=o3-pro


