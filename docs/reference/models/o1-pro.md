# o1-pro

- Model ID: o1-pro
- Model type: reasoning
- Current snapshot: o1-pro-2025-03-19

Version of o1 with more compute for better responses

The o1 series of models are trained with reinforcement learning to think 
before they answer and perform complex reasoning. The o1-pro model uses more 
compute to think harder and provide consistently better answers.

o1-pro is available in the [Responses API only](https://developers.openai.com/api/docs/api-reference/responses)
to enable support for multi-turn model interactions before responding to API
requests, and other advanced API features in the future.

## Snapshots
- o1-pro-2025-03-19

## Current snapshot details
- Context window: 200,000 tokens
- Max output: 100,000 tokens
- Knowledge cutoff: 2023-10-01
- Input modalities: text, image
- Output modalities: text
- Supported endpoints: responses, batch
- Supported features: structured_outputs, function_calling, image_input

## Supported tools
- function_calling
- file_search
- mcp

Playground: https://platform.openai.com/chat/edit?models=o1-pro


