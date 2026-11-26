// Copied from tensor_derivation (src/render.ts at 9492e67). Only import paths changed.
// The text format used in expected/, expected-labels/, expected-factors/ and by the CLI.
import type { Position, Tensors } from "./tensors";
import type { Column, Label, Labelled } from "./labels";
import type { Factored } from "./factors";

const pos = (p: Position) => `(${p.join(", ")})`;
const seq = (t: Position[]) => `[${t.map(pos).join(", ")}]`;
const INDENT = " ".repeat(20);

function block<T>(name: string, items: T[], fmt: (x: T) => string): string[] {
  if (items.length === 0) return [`        ${name.padEnd(12)}[]`];
  return items.map((x, i) => (i === 0 ? `        ${name.padEnd(12)}` : INDENT) + fmt(x));
}

export function renderText(t: Tensors): string {
  return (
    [
      ...block("trajectory", t.trajectories, seq),
      ...block("partition", t.partitions, seq),
      ...block(
        "panel",
        t.panels,
        (p) =>
          `{anchor: ${p.anchor}, reads: ${pos(p.reads)}}` +
          Object.entries(p.arms)
            .map(([k, v]) => `\n${INDENT}    ${k}: ${seq(v)}`)
            .join(""),
      ),
      ...block("recurrence", t.recurrences[0] ?? [], pos),
    ].join("\n") + "\n"
  );
}

const cell = (v: string) => (v === "" ? "-" : v);
const col = (c: Column) =>
  `${c.cols.join("+")}: ${c.values.map((v) => (v === null ? "()" : v.map(cell).join("|"))).join(", ")}`;
const LABEL = INDENT + "    ";

function labelLines(l: Label): string {
  return [
    ...(l.axes.length > 0 ? l.axes.map((a) => `axis      ${col(a)}`) : ["axis      none"]),
    ...l.mixed.map((m) => `mixed     ${col(m)}`),
    ...(l.within.length > 0 ? [`within    ${l.within.join(", ")}`] : []),
    ...(l.constant.length > 0
      ? [`constant  ${l.constant.map(([k, v]) => `${k}=${v}`).join(", ")}`]
      : []),
    ...(l.end.length > 0 ? [`end       ${l.end.map(([k, v]) => `${k}=${v}`).join(", ")}`] : []),
  ]
    .map((s) => `\n${LABEL}${s}`)
    .join("");
}

export function renderFactors(fs: Factored[]): string {
  return (
    block("factors", fs, (f) => {
      const head =
        f.axis.length > 0
          ? `${f.axis.join("+")}: ${f.values.map((v) => v.map(cell).join("|")).join(", ")}`
          : "axis none";
      const names = f.rows.map((r) => r.factors.map(([k, v]) => `${k}=${cell(v)}`).join(" "));
      const w = Math.max(0, ...names.map((n) => n.length));
      return (
        head +
        f.forks
          .map(
            (k) =>
              `\n${LABEL}fork ${k.at}: ${k.factors.join(", ") || "none"}${k.confounded ? "  confounded" : ""}`,
          )
          .join("") +
        f.rows
          .map(
            (r, i) =>
              `\n${LABEL}${w > 0 ? names[i]!.padEnd(w + 2) : ""}[${r.cells.map((c) => (c ? pos(c) : "·")).join(", ")}]`,
          )
          .join("")
      );
    }).join("\n") + "\n"
  );
}

export function renderLabels(t: Labelled): string {
  return (
    [
      ...block("trajectory", t.trajectories, (x) => seq(x.tensor) + labelLines(x.label)),
      ...block("partition", t.partitions, (x) => seq(x.tensor) + labelLines(x.label)),
      ...block(
        "panel",
        t.panels,
        (x) =>
          `{anchor: ${x.panel.anchor}} ${Object.keys(x.panel.arms).join(", ")}` +
          labelLines(x.label),
      ),
      ...block("recurrence", t.recurrences, (x) => seq(x.tensor) + labelLines(x.label)),
    ].join("\n") + "\n"
  );
}
