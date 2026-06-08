export function buildTemplatePrompt(code: string, language?: string): string {
  const lang = language?.trim() || "javascript";

  return `You generate ONLY short explanation templates for an algorithm visualizer. Do NOT trace execution or invent variable values.

LANG: ${lang}
CODE:
${code}

Return ONE JSON object (no markdown):
{
  "name": "Algorithm name",
  "description": "Under 60 chars",
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)",
  "primaryMode": "ARRAY" | "HASH_MAP" | "LINKED_LIST" | "TREE",
  "defaultTemplate": "Fallback: Line {line} with i={i}",
  "steps": [
    {
      "line": 5,
      "template": "At i={i}, nums[{i}]={nums[i]}, need complement {complement}",
      "statusType": "EXPLORE",
      "mode": "ARRAY",
      "overlayModes": ["ARRAY", "HASH_MAP"]
    }
  ]
}

RULES:
- steps: 4-8 templates with {var} placeholders matching variable names in the code
- Use placeholders like {i}, {j}, {sum}, {target}, {res}, {path}, {remain}, {complement}
- Templates describe WHAT happens; real values are filled at runtime
- No timeline arrays, no structures, no frame data
- Return valid JSON only`;
}
