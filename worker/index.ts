import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { handleStudioRequest } from "../lib/studio/server";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (new URL(request.url).pathname.startsWith('/api/studio/')) {
      // Dev: Vite studio-local-api middleware handles /api/studio with Node + OPENAI_STUDIO_PROXY.
      // Never import undici here — it breaks the vinext RSC worker runner (Console.createTask).
      if (import.meta.env.DEV) {
        return handleStudioRequest(request, env.SESSION_SECRET, fetch);
      }
      return import("../lib/studio/outbound-fetch").then(({ createOutboundFetch }) =>
        handleStudioRequest(
          request,
          env.SESSION_SECRET,
          createOutboundFetch(env.OPENAI_STUDIO_PROXY),
        ),
      );
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
