export const MCP_PROMPT_POLICY = [
  "Use only Saatgut MCP tool and resource data.",
  "If the available data is incomplete, say what is missing.",
  "Ask a follow-up question before taking action when inputs or identifiers are ambiguous.",
  "Treat write tools as review-first workflows: run with dry_run=true before committing changes.",
].join(" ");

export type McpPromptDefinition = {
  name: string;
  title: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
};

const promptDefinitions: McpPromptDefinition[] = [
  {
    name: "weekly_plan",
    title: "Weekly Plan",
    description: "Build a practical sowing and task plan for the next gardening window.",
    arguments: [
      { name: "days", description: "How many days to preview from today.", required: false },
      { name: "focus", description: "Optional focus area such as tomatoes or direct sowing.", required: false },
    ],
  },
  {
    name: "conservation_review",
    title: "Conservation Review",
    description: "Review which heirloom or preservation varieties need regeneration attention this season.",
    arguments: [{ name: "tag", description: "Optional variety tag to narrow the review.", required: false }],
  },
  {
    name: "seed_quality_review",
    title: "Seed Quality Review",
    description: "Review ageing seed batches, missing germination tests, and storage warnings.",
    arguments: [{ name: "severity", description: "Optional warning severity filter.", required: false }],
  },
];

export function listMcpPrompts() {
  return promptDefinitions;
}

export function getMcpPrompt(name: string, args: Record<string, string | undefined> = {}) {
  const prompt = promptDefinitions.find((candidate) => candidate.name === name);

  if (!prompt) {
    return null;
  }

  const renderedArgs = Object.entries(args)
    .filter((entry) => entry[1] !== undefined && entry[1] !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return {
    description: prompt.description,
    messages: [
      {
        role: "system" as const,
        content: {
          type: "text" as const,
          text: MCP_PROMPT_POLICY,
        },
      },
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Workflow: ${prompt.title}.`,
            prompt.description,
            renderedArgs ? `Inputs:\n${renderedArgs}` : null,
            "Use the available MCP tools and resources to gather the current workspace data before answering.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      },
    ],
  };
}
