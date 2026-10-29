# GPT-5.6 Luna

- Model ID: gpt-5.6-luna
- Model type: reasoning
- Current snapshot: gpt-5.6-luna

GPT-5.6 model optimized for cost-sensitive workloads

GPT-5.6 Luna is designed for cost-sensitive, high-volume workloads. It
roughly corresponds to the nano model tier used in earlier GPT-5 families.
Reasoning.effort supports: none, low, medium (default), high, xhigh, and max.

## Snapshots
- gpt-5.6-luna

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
- Prompts with >272K input tokens are priced at 2x input and 1.5x output for the full request.
- Cache writes are billed at 1.25x the uncached input token rate.

Playground: https://platform.openai.com/chat/edit?models=gpt-5.6-luna


