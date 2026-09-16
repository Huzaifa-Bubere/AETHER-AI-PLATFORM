import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import type { IAstNode, CodingLanguage } from '../types/coding.types';

/**
 * AETHER Coding — Language Parser Registry.
 *
 * Strategy per language:
 * - javascript / typescript → deterministic parse with acorn (real ESTree AST).
 * - java / cpp / c / python → lightweight structural parser (brace/indent-aware
 *   block detection + statement classification). Deliberately NOT regex-only:
 *   it tracks nesting structure, line ranges, and statement kinds, producing the
 *   same IAstNode tree contract so downstream metric/pattern/complexity passes
 *   are language-agnostic. Parser adapters for tree-sitter can slot in here later.
 */

export interface ParsedProgram {
  parseSuccess: boolean;
  parser: 'acorn' | 'heuristic' | 'none';
  reason?: string;
  tree: IAstNode | null;
  /** Raw ESTree AST for JS/TS (used by metrics pass); null for heuristic languages. */
  estree?: acorn.Node | null;
  sourceLines: string[];
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

// ── Acorn (JS/TS) ────────────────────────────────────────────────────────────

function acornLabel(node: acorn.Node): string {
  const n = node as any;
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return `${node.type}: ${n.id?.name || '<anonymous>'}`;
    case 'VariableDeclarator':
      return `Variable: ${n.id?.name || '<pattern>'}`;
    case 'Identifier':
      return `Identifier: ${n.name}`;
    case 'CallExpression': {
      const callee = n.callee?.name || n.callee?.property?.name || 'call';
      return `Call: ${callee}()`;
    }
    case 'MemberExpression':
      return `Member: ${n.property?.name || '…'}`;
    case 'Literal':
      return `Literal: ${String(n.value).slice(0, 24)}`;
    case 'BinaryExpression':
      return `Binary: ${n.operator}`;
    case 'AssignmentExpression':
      return `Assignment: ${n.operator}`;
    case 'UpdateExpression':
      return `Update: ${n.operator}`;
    case 'ForStatement':
      return 'ForStatement';
    case 'ForOfStatement':
      return `ForOf: ${n.left?.declarations?.[0]?.id?.name || n.left?.name || 'item'}`;
    case 'ForInStatement':
      return `ForIn: ${n.left?.declarations?.[0]?.id?.name || n.left?.name || 'key'}`;
    case 'WhileStatement':
      return 'WhileStatement';
    case 'DoWhileStatement':
      return 'DoWhileStatement';
    case 'IfStatement':
      return 'IfStatement';
    case 'SwitchStatement':
      return 'SwitchStatement';
    case 'BlockStatement':
      return 'BlockStatement';
    case 'ReturnStatement':
      return 'ReturnStatement';
    case 'NewExpression':
      return `New: ${n.callee?.name || '…'}`;
    case 'ClassDeclaration':
      return `Class: ${n.id?.name || '<anon>'}`;
    case 'MethodDefinition':
      return `Method: ${n.key?.name || '<anon>'}`;
    default:
      return node.type;
  }
}

function estreeToIAst(node: acorn.Node | null | undefined, depth = 0): IAstNode | null {
  if (!node || typeof node !== 'object' || depth > 40) return null;
  const children: IAstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') {
          const child = estreeToIAst(item, depth + 1);
          if (child) children.push(child);
        }
      }
    } else if (value && typeof value.type === 'string') {
      const child = estreeToIAst(value, depth + 1);
      if (child) children.push(child);
    }
  }
  return {
    id: nextId('ast'),
    type: node.type,
    label: acornLabel(node),
    loc: (node as any).loc
      ? {
          startLine: (node as any).loc.start.line,
          endLine: (node as any).loc.end.line,
          startCol: (node as any).loc.start.column,
          endCol: (node as any).loc.end.column,
        }
      : undefined,
    children,
  };
}

function parseWithAcorn(source: string, language: 'javascript' | 'typescript'): ParsedProgram {
  const sourceLines = source.split('\n');
  try {
    // acorn cannot parse TS type annotations — strip common type-only syntax first.
    const effective = language === 'typescript' ? stripTypeScriptSyntax(source) : source;
    const ast = acorn.parse(effective, {
      ecmaVersion: 2022,
      locations: true,
      allowReturnOutsideFunction: true,
    }) as acorn.Node;
    // Map locations back to ORIGINAL source line numbers (TS stripping preserves lines).
    return {
      parseSuccess: true,
      parser: 'acorn',
      tree: estreeToIAst(ast),
      estree: ast,
      sourceLines,
    };
  } catch (err: any) {
    return {
      parseSuccess: false,
      parser: 'acorn',
      reason: `JavaScript/TypeScript parse error: ${err?.message || 'unknown'}`,
      tree: null,
      estree: null,
      sourceLines,
    };
  }
}

/** Line-preserving TS → JS syntax strip (type annotations, interfaces, generics on decls). */
function stripTypeScriptSyntax(source: string): string {
  return source
    .split('\n')
    .map(line => {
      let out = line;
      out = out.replace(/^\s*(interface|type)\s+\w+[^{]*\{.*\}\s*$/, m => m.replace(/./g, ' '));
      out = out.replace(/^\s*(import|export)\s+type\s.*$/, m => m.replace(/./g, ' '));
      // param/variable type annotations: `x: number` → `x`
      out = out.replace(/(\b[A-Za-z_$][\w$]*)\s*:\s*(?!\/)(?:[A-Za-z_$][\w$<>.\[\], |&]*)/g, '$1');
      // return type annotations before brace: `): string {` → `) {`
      out = out.replace(/\)\s*:\s*[A-Za-z_$][\w$<>.\[\], |&]*\s*(=>\s*)?\{/g, ') {');
      // `as Type` casts
      out = out.replace(/\s+as\s+[A-Za-z_$][\w$<>.\[\]]*/g, '');
      // generic call sites like foo<number>() — keep identifier
      out = out.replace(/([A-Za-z_$][\w$]*)<[^<>()]*>\(/g, '$1(');
      // access modifiers on class members
      out = out.replace(/\b(public|private|protected|readonly)\s+/g, '');
      return out;
    })
    .join('\n');
}

// ── Heuristic structural parser (Python / Java / C / C++) ───────────────────

type BlockKind =
  | 'FunctionDeclaration'
  | 'ClassDeclaration'
  | 'ForStatement'
  | 'WhileStatement'
  | 'IfStatement'
  | 'SwitchStatement'
  | 'TryStatement'
  | 'BlockStatement'
  | 'Statement';

interface RawBlock {
  kind: BlockKind;
  label: string;
  startLine: number;
  endLine: number;
  children: RawBlock[];
}

function classifyPythonLine(line: string): { kind: BlockKind; label: string; opens: boolean } {
  const t = line.trim();
  if (/^(async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.test(t)) {
    const m = t.match(/def\s+([A-Za-z_]\w*)/);
    return { kind: 'FunctionDeclaration', label: `Function: ${m?.[1]}`, opens: true };
  }
  if (/^class\s+([A-Za-z_]\w*)/.test(t)) {
    const m = t.match(/class\s+([A-Za-z_]\w*)/);
    return { kind: 'ClassDeclaration', label: `Class: ${m?.[1]}`, opens: true };
  }
  if (/^for\s+/.test(t)) {
    const m = t.match(/for\s+(\w+)/);
    return { kind: 'ForStatement', label: `ForOf: ${m?.[1] || 'item'}`, opens: true };
  }
  if (/^while\s+/.test(t)) return { kind: 'WhileStatement', label: 'WhileStatement', opens: true };
  if (/^if\s+/.test(t) || /^elif\s+/.test(t)) return { kind: 'IfStatement', label: 'IfStatement', opens: true };
  if (/^with\s+/.test(t)) return { kind: 'BlockStatement', label: 'WithStatement', opens: true };
  if (/^try\s*:/.test(t)) return { kind: 'TryStatement', label: 'TryStatement', opens: true };
  return { kind: 'Statement', label: classifyStatementLabel(t), opens: false };
}

function classifyBraceLangLine(line: string): { kind: BlockKind; label: string; opens: boolean; closes: boolean } {
  const t = line.trim();
  const closes = /^\}/.test(t);
  if (/(?:public|private|protected|static|final|synchronized)*\s*(?:[\w<>\[\],\s]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:throws\s[\w,\s]+)?\{\s*$/.test(t) && !/\b(if|for|while|switch|catch|do)\b/.test(t)) {
    return { kind: 'FunctionDeclaration', label: `Function: ${t.match(/([A-Za-z_]\w*)\s*\(/)?.[1] || '<anon>'}`, opens: true, closes };
  }
  if (/\bclass\s+([A-Za-z_]\w*)/.test(t)) {
    return { kind: 'ClassDeclaration', label: `Class: ${t.match(/class\s+([A-Za-z_]\w*)/)?.[1]}`, opens: true, closes };
  }
  if (/\bfor\s*\(/.test(t)) return { kind: 'ForStatement', label: 'ForStatement', opens: /\{\s*$/.test(t), closes };
  if (/\bwhile\s*\(/.test(t)) return { kind: 'WhileStatement', label: 'WhileStatement', opens: /\{\s*$/.test(t), closes };
  if (/\bif\s*\(/.test(t)) return { kind: 'IfStatement', label: 'IfStatement', opens: /\{\s*$/.test(t), closes };
  if (/\bswitch\s*\(/.test(t)) return { kind: 'SwitchStatement', label: 'SwitchStatement', opens: /\{\s*$/.test(t), closes };
  if (/\btry\s*\{/.test(t)) return { kind: 'TryStatement', label: 'TryStatement', opens: true, closes };
  if (/\bcatch\s*\(/.test(t)) return { kind: 'BlockStatement', label: 'CatchClause', opens: true, closes };
  if (/\belse\b/.test(t)) return { kind: 'IfStatement', label: 'ElseClause', opens: /\{\s*$/.test(t), closes };
  if (/\{\s*$/.test(t)) return { kind: 'BlockStatement', label: 'BlockStatement', opens: true, closes };
  return { kind: 'Statement', label: classifyStatementLabel(t), opens: false, closes };
}

function classifyStatementLabel(t: string): string {
  if (/^(return\b)/.test(t)) return 'ReturnStatement';
  if (/^(break\b)/.test(t)) return 'BreakStatement';
  if (/^(continue\b)/.test(t)) return 'ContinueStatement';
  if (/^(const|let|var)\s+/.test(t)) return `Variable: ${t.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/)?.[1] || ''}`;
  if (/^(int|float|double|long|short|char|bool|boolean|String|auto|unsigned)\s+/.test(t)) {
    return `Declaration: ${t.match(/([A-Za-z_]\w*)\s*(?:=|;)/)?.[1] || ''}`;
  }
  if (/^[A-Za-z_$][\w$.]*\s*\(/.test(t)) return `Call: ${t.match(/^([A-Za-z_$][\w$.]*)\s*\(/)?.[1] || 'call'}()`;
  if (/[+\-*/%]=/.test(t) || /^[\w.\[\]]+\s*=[^=]/.test(t)) return 'AssignmentExpression';
  if (/^(print|cout|System\.out)/.test(t)) return 'OutputStatement';
  if (t.startsWith('#include') || t.startsWith('import ') || t.startsWith('from ')) return 'ImportDeclaration';
  return 'Statement';
}

/** Indent-aware Python block builder. */
function buildPythonBlocks(lines: string[]): RawBlock[] {
  const root: RawBlock = { kind: 'BlockStatement', label: 'Program', startLine: 1, endLine: lines.length, children: [] };
  const stack: Array<{ block: RawBlock; indent: number }> = [{ block: root, indent: -1 }];

  lines.forEach((line, idx) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const indent = line.match(/^\s*/)?.[0].replace(/\t/g, '    ').length ?? 0;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      const finished = stack.pop()!;
      finished.block.endLine = idx;
    }

    const { kind, label, opens } = classifyPythonLine(line);
    if (opens) {
      const block: RawBlock = { kind, label, startLine: idx + 1, endLine: idx + 1, children: [] };
      stack[stack.length - 1].block.children.push(block);
      stack.push({ block, indent });
    } else {
      const parent = stack[stack.length - 1].block;
      parent.children.push({ kind, label, startLine: idx + 1, endLine: idx + 1, children: [] });
    }
  });

  return root.children;
}

/** Brace-aware Java/C/C++ block builder. */
function buildBraceBlocks(lines: string[]): RawBlock[] {
  const root: RawBlock = { kind: 'BlockStatement', label: 'Program', startLine: 1, endLine: lines.length, children: [] };
  const stack: RawBlock[] = [root];
  let depth = 0;

  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const { kind, label, opens, closes } = classifyBraceLangLine(line);

    if (opens) {
      const block: RawBlock = { kind, label, startLine: idx + 1, endLine: idx + 1, children: [] };
      stack[stack.length - 1].children.push(block);
      stack.push(block);
      depth++;
    } else {
      stack[stack.length - 1].children.push({ kind, label, startLine: idx + 1, endLine: idx + 1, children: [] });
    }

    // Count closing braces on this line beyond the opener
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    let netCloses = closeCount - (opens && openCount === closeCount ? 0 : Math.max(0, closeCount - closeCount));
    netCloses = Math.max(0, closeCount - (opens ? openCount - 1 : 0) - (closes ? 1 : 0));
    for (let i = 0; i < Math.max(0, netCloses) && stack.length > 1; i++) {
      const finished = stack.pop()!;
      finished.endLine = idx + 1;
      depth--;
    }
  });

  while (stack.length > 1) {
    const finished = stack.pop()!;
    finished.endLine = lines.length;
  }

  return root.children;
}

function rawToIAst(blocks: RawBlock[]): IAstNode {
  return {
    id: nextId('ast'),
    type: 'Program',
    label: 'Program',
    children: blocks.map(b => rawBlockToIAst(b)),
  };
}

function rawBlockToIAst(b: RawBlock): IAstNode {
  return {
    id: nextId('ast'),
    type: b.kind,
    label: b.label,
    loc: { startLine: b.startLine, endLine: b.endLine },
    children: b.children.map(c => rawBlockToIAst(c)),
  };
}

function parseHeuristic(source: string, language: CodingLanguage): ParsedProgram {
  const sourceLines = source.split('\n');
  try {
    if (language === 'python') {
      const blocks = buildPythonBlocks(sourceLines);
      const hasContent = blocks.some(b => b.children.length > 0 || b.kind !== 'Statement');
      if (!hasContent && source.trim().length > 0) {
        // Module-level only script — still a valid parse with flat statements
        return { parseSuccess: true, parser: 'heuristic', tree: rawToIAst(blocks), sourceLines };
      }
      return { parseSuccess: true, parser: 'heuristic', tree: rawToIAst(blocks), sourceLines };
    }
    if (language === 'java' || language === 'cpp' || language === 'c') {
      const blocks = buildBraceBlocks(sourceLines);
      return { parseSuccess: true, parser: 'heuristic', tree: rawToIAst(blocks), sourceLines };
    }
    return {
      parseSuccess: false,
      parser: 'none',
      reason: `No parser adapter for language: ${language}`,
      tree: null,
      sourceLines,
    };
  } catch (err: any) {
    return {
      parseSuccess: false,
      parser: 'heuristic',
      reason: `Structural parse error: ${err?.message || 'unknown'}`,
      tree: null,
      sourceLines,
    };
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

export function parseSource(source: string, language: CodingLanguage): ParsedProgram {
  if (language === 'javascript' || language === 'typescript') {
    return parseWithAcorn(source, language);
  }
  return parseHeuristic(source, language);
}

/** Languages with fully deterministic (real AST) parsing. */
export function isDeterministicParser(language: CodingLanguage): boolean {
  return language === 'javascript' || language === 'typescript';
}

export { walk };
