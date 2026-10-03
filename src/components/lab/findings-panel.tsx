import type { ReactNode } from "react";
import findingsMd from "@/lib/engine/findings.md?raw";

function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-medium text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${keyBase}-${i}`} className="font-mono text-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

export function FindingsPanel() {
  const lines = findingsMd.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let table: string[][] = [];
  let code: string[] = [];
  let list: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    blocks.push(
      <p key={`p-${k++}`} className="text-sm text-muted">
        {renderInline(text, `p${k}`)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ol key={`ol-${k++}`} className="list-decimal space-y-1 pl-5 text-sm text-muted">
        {list.map((item, i) => (
          <li key={i}>{renderInline(item, `li${k}-${i}`)}</li>
        ))}
      </ol>,
    );
    list = [];
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push(
      <pre
        key={`pre-${k++}`}
        className="overflow-x-auto rounded-md bg-raised p-3 font-mono text-xs text-fg"
      >
        {code.join("\n")}
      </pre>,
    );
    code = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const header = table[0]!;
    const rows = table.slice(2);
    blocks.push(
      <div key={`tbl-${k++}`} className="overflow-x-auto rounded-md bg-raised">
        <table className="w-full min-w-3xl border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="text-subtle">
              {header.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/80">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2 text-muted">
                    {renderInline(c, `td${i}-${j}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = [];
  };

  let inCode = false;
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushPara();
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (line.startsWith("|")) {
      flushPara();
      flushList();
      table.push(
        line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim()),
      );
      continue;
    }
    if (table.length) flushTable();
    if (/^\d+\.\s/.test(line)) {
      flushPara();
      list.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }
    if (list.length && line.trim() === "") {
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushPara();
      flushList();
      blocks.push(
        <h2 key={`h-${k++}`} className="font-display text-2xl font-medium tracking-tight">
          {line.slice(2)}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push(
        <h3 key={`h-${k++}`} className="mt-2 font-display text-xl font-medium tracking-tight">
          {line.slice(3)}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("---")) {
      flushPara();
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      flushPara();
      blocks.push(
        <p key={`em-${k++}`} className="text-sm text-subtle italic">
          {line.slice(1, -1)}
        </p>,
      );
      continue;
    }
    para.push(line);
  }
  flushCode();
  flushTable();
  flushList();
  flushPara();

  return <article className="flex max-w-3xl flex-col gap-4">{blocks}</article>;
}
