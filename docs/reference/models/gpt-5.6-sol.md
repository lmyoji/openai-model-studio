# GPT-5.6 Sol

- Model ID: gpt-5.6-sol
- Model type: reasoning
- Current snapshot: gpt-5.6-sol

GPT-5.6 flagship model for complex professional work

GPT-5.6 Sol is a flagship model in the GPT-5.6 family. It roughly
corresponds to the unsuffixed model tier used in earlier GPT-5 families.
The `gpt-5.6` alias routes requests to GPT-5.6 Sol.
Reasoning.effort supports: none, low, medium (default), high, xhigh, and max.

## Snapshots
- gpt-5.6-sol

## Current snapshot details
- Context window: 1,050,000 tokens
- Max input: 922,000 tokens
- Max output: 128,000 tokens
- Knowledge cutoff: 2026-02-16
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
- GPT-5.6 Sol costs $4 per million input tokens and $20 per million output tokens, a 20% reduction in input pricing and a 33% reduction in output pricing. GPT-5.6 Sol’s promotional pricing is available at least through November 21, 2026.
- Prompts with >272K input tokens are priced at 2x input and 1.5x output for the full request.
- Cache writes are billed at 1.25x the uncached input token rate.

Playground: https://platform.openai.com/chat/edit?models=gpt-5.6-sol


