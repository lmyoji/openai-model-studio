## Configure Responses delegation

Add this delegation configuration when [creating your Live session](https://developers.openai.com/api/docs/guides/live). Choose the Responses model independently of the voice model:

```javascript
export const session = {
  model: "gpt-live-1",
  delegation: {
    type: "responses",
    responses: {
      model: "gpt-6-luna",
      instructions: "[Your backend prompt]",
    },
  },
};
```

```python
from openai.types.live.session_config_param import SessionConfigParam

session: SessionConfigParam = {
    "model": "gpt-live-1",
    "delegation": {
        "type": "responses",
        "responses": {
            "model": "gpt-6-luna",
            "instructions": "[Your backend prompt]",
        },
    },
}
```


Start with [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna), or try [`gpt-6-sol`](https://developers.openai.com/api/docs/models/gpt-6-sol) for more complex backend tasks. Compare answer quality and latency on your tasks before choosing a backend model.

Register supported tools in `delegation.responses.tools`. Set `delegation.responses.tool_choice` to `"auto"` to let the backend choose a tool, `"required"` to require a tool call, or `"none"` to disable tool calls. You can also select a named function.

Set `delegation.responses.parallel_tool_calls` to `true` to allow multiple tool calls in a response, or `false` for sequential calls. Your application executes custom functions and checks their dependencies and required approvals. These settings apply after GPT-Live delegates; use the [live prompt](https://developers.openai.com/api/docs/guides/live-prompting#delegation) to guide when it should delegate.

The Responses configuration requires a backend `model` at creation. In addition to the tools below, it exposes `max_output_tokens` (at least 16 when set), `service_tier`, and the `reasoning` and `text` settings supported by the selected backend model. See [Reduce backend latency](#reduce-backend-latency) for settings you can tune.

If [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode) is available for your model and project, consider it for latency-sensitive calls. For GPT-Live, select it with `delegation.responses.service_tier: "priority"`.

Send `session.update` with changes in `session.delegation.responses` to update the backend model, instructions, tools, `tool_choice`, or other supported settings during the conversation. Omitted settings keep their current values.

To switch between Responses and client delegation, create a new Live session. Updating `delegation` to `null` selects client mode, so sending it to a running Responses session fails with `immutable_field_update`.

These settings use familiar Responses concepts, but Live supports a subset of the standalone Responses API. Live supplies conversation context and initiates delegated work. Configure the backend through the session; the Live `response.create` command uses that configuration and does not accept a standalone Responses request body.

### Add hosted tools

Add [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [file search](https://developers.openai.com/api/docs/guides/tools-file-search), [Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter), [hosted shell](https://developers.openai.com/api/docs/guides/tools-shell), or [image generation](https://developers.openai.com/api/docs/guides/tools-image-generation) to `delegation.responses.tools`. Follow the linked guides for configuration, model support, and required resources. Responses runs these tools and returns their results automatically.

For shell, use a hosted container, optionally with [Skills](https://developers.openai.com/api/docs/guides/tools-skills). For newly uploaded Skills, [wait until the referenced version is readable](https://developers.openai.com/api/docs/guides/tools-skills#wait-for-an-uploaded-version) before starting the Live session. Local shell requires your application to run calls. Live does not support shell `domain_secrets`.

### Add MCP and other tools

Responses delegation also supports [MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp), [tool search](https://developers.openai.com/api/docs/guides/tools-tool-search), [programmatic tool calling](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling), [functions and custom tools](https://developers.openai.com/api/docs/guides/function-calling), [computer use](https://developers.openai.com/api/docs/guides/tools-computer-use), [local shell](https://developers.openai.com/api/docs/guides/tools-shell#local-shell-mode), and [apply patch](https://developers.openai.com/api/docs/guides/tools-apply-patch). Use the linked guides for setup. Return application results and approval decisions through the [Live continuation flow](#return-tool-results-and-approvals).

Live passes the MCP `authorization` and `headers` you provide to Responses, but doesn't include those values in the session configuration it sends back to your application. You don't need to resend them when updating other settings, such as instructions. If you replace `delegation.responses.tools`, include the MCP credentials again.

### Handle configuration errors

Live validates Responses settings asynchronously after startup and when the settings change. `session.started` and `session.updated` do not wait for this validation. Listen for an `error` with code `responses_validation_failed` and check its message for the unsupported setting or inaccessible resource. The session stays open and the settings are not rolled back; correct them with `session.update`.

For example, a numeric Skill `version`, such as `1`, produces a nonfatal `responses_validation_failed` error for `session.start` or `session.update`. The error message identifies the invalid field and expected type without waiting for `response.create`. Match `error.client_event_id` to the settings event. To recover in the same session, remove the invalid tool configuration with `session.update`. Use string versions, such as `"1"`.

Validation does not guarantee later tool execution. Resource access and tool availability can change, so continue handling backend errors during delegated work. Configuring hosted tools can initialize resources such as containers during validation.

