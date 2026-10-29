# gpt-oss-20b

- Model ID: gpt-oss-20b
- Model type: reasoning
- Current snapshot: gpt-oss-20b

Medium-sized open-weight model for low latency

`gpt-oss-20b` is our medium-sized open-weight model for low latency, local, or 
specialized use-cases (21B parameters with 3.6B active parameters).

[Download gpt-oss-20b on HuggingFace](https://huggingface.co/openai/gpt-oss-20b).

**Key features**

-   **Permissive Apache 2.0 license:** Build freely without copyleft restrictions or patent risk—ideal for experimentation, customization, and commercial deployment.
-   **Configurable reasoning effort:** Easily adjust the reasoning effort (low, medium, high) based on your specific use case and latency needs.
-   **Full chain-of-thought:** Gain complete access to the model's reasoning process, facilitating easier debugging and increased trust in outputs.
-   **Fine-tunable:** Fully customize models to your specific use case through parameter fine-tuning.
-   **Agentic capabilities:** Use the models' native capabilities for function calling, web browsing, Python code execution, and structured outputs.

## Snapshots
- gpt-oss-20b

## Current snapshot details
- Context window: 131,072 tokens
- Max output: 131,072 tokens
- Knowledge cutoff: 2024-06-01
- Input modalities: text
- Output modalities: text
- Supported endpoints: responses, batch
- Supported features: streaming, structured_outputs, function_calling

## Supported tools
- function_calling
- code_interpreter
- mcp
- web_search


