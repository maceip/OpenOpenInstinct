import { defineAgent, defineDynamic } from "eve";
import { getModelSettings } from "@/lib/model-config";

export default defineAgent({
  experimental: {
    tasks: true,
  },
  model: defineDynamic({
    events: {
      "step.started": async (_event, ctx) => {
        const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
        if (!caller) throw new Error("An authenticated user is required.");
        const configured = getModelSettings();
        return {
          model: configured.model,
          modelContextWindowTokens: configured.modelContextWindowTokens,
        };
      },
    },
  }),
  reasoning: "low",
  compaction: {
    thresholdPercent: 0.7,
  },
});
