import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";
import { detectFunctionName } from "../detectPattern";
import { inferTechniqueFromCode } from "@/lib/engine/technique/inferTechnique";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";
import { traceByTechnique } from "./techniqueGeneric";
import { traceHashSetScan } from "./hashSetScan";

function traceArrayLoop(arr: number[], fnName: string | null, technique: VisualizationTechnique): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  let step = 0;

  frames.push({
    step: step++,
    mode: "ARRAY",
    technique,
    structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
    activePointers: {},
    highlightedElements: [],
    statusType: "EXPLORE",
    message: `Init: scan array [${arr.join(", ")}]`,
    variables: { nums: [...arr] },
  });

  for (let i = 0; i < Math.min(arr.length, 6); i++) {
    frames.push({
      step: step++,
      mode: "ARRAY",
      technique,
      structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
      activePointers: { i },
      highlightedElements: [i],
      statusType: "EXPLORE",
      message: `i=${i}: arr[${i}]=${arr[i]}`,
      variables: { i, nums: [...arr] },
    });
  }

  frames.push({
    step: step++,
    mode: "ARRAY",
    technique,
    structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
    activePointers: {},
    highlightedElements: [],
    statusType: "SUCCESS",
    message: "Scan complete",
    variables: { nums: [...arr] },
  });

  return frames;
}

function traceGenericLinkedList(values: number[], fnName: string | null): TimelineFrame[] {
  const nodes = values.map((value, i) => ({
    id: `n${i}`,
    value,
    next: i < values.length - 1 ? `n${i + 1}` : null,
  }));
  const frames: TimelineFrame[] = [];
  let step = 0;

  frames.push({
    step: step++,
    mode: "LINKED_LIST",
    technique: "linked_list",
    structures: { arrayData: [], mapData: {}, listData: nodes.map((n) => ({ ...n })), treeData: [] },
    activePointers: { current: "n0" },
    highlightedElements: ["n0"],
    statusType: "EXPLORE",
    message: `${fnName ?? "list"}: start at head`,
    variables: { current: "n0" },
  });

  for (let i = 0; i < Math.min(nodes.length, 5); i++) {
    frames.push({
      step: step++,
      mode: "LINKED_LIST",
      technique: "linked_list",
      structures: { arrayData: [], mapData: {}, listData: nodes.map((n) => ({ ...n })), treeData: [] },
      activePointers: { current: `n${i}` },
      highlightedElements: [`n${i}`],
      statusType: "EXPLORE",
      message: `Visit n${i} (value=${values[i]})`,
      variables: { current: `n${i}` },
    });
  }

  return frames;
}

export function traceGeneric(code: string, inputs: DSAInputs, language?: string): DSATracerResult {
  const fnName = detectFunctionName(code);
  const arr = inputs.arr ?? inputs.nums ?? inputs.candidates ?? [1, 2, 3, 4, 5];
  const technique = inferTechniqueFromCode(code);

  if (technique === "hash_set") {
    const hs = traceHashSetScan(inputs, fnName);
    return {
      timeline: hs.timeline,
      name: hs.name,
      description: hs.description,
      timeComplexity: hs.timeComplexity,
      spaceComplexity: hs.spaceComplexity,
      primaryMode: hs.primaryMode,
    };
  }

  const specialized = traceByTechnique(technique, arr, fnName, inputs.k);
  if (specialized && specialized.length > 0) {
    const primaryMode = specialized[0].mode;
    return {
      timeline: specialized,
      name: fnName ? `${fnName}` : "Algorithm",
      description: `${technique.replace(/_/g, " ")} visualization`,
      primaryMode,
    };
  }

  let timeline: TimelineFrame[];
  let primaryMode: DSATracerResult["primaryMode"] = "ARRAY";

  if (technique === "linked_list" || technique === "linked_list_cycle") {
    timeline = traceGenericLinkedList(inputs.listValues ?? arr, fnName);
    primaryMode = "LINKED_LIST";
  } else {
    timeline = traceArrayLoop(arr, fnName, technique);
  }

  return {
    timeline,
    name: fnName ? `${fnName}` : "Algorithm",
    description: `Visualization from ${language ?? "code"} (${technique.replace(/_/g, " ")})`,
    primaryMode,
  };
}
