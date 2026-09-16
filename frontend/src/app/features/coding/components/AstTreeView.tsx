import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, Hash } from 'lucide-react';
import type { IAstNode } from '../types';

/**
 * AETHER Coding — interactive AST tree.
 * Click a node → onSelectNode fires (Monaco highlights that source range).
 * Collapse/expand, search filter, and node detail panel included.
 */

interface AstTreeViewProps {
  tree: IAstNode;
  onSelectNode?: (node: IAstNode) => void;
  /** Line number currently highlighted in the editor (for reverse sync). */
  highlightedLine?: number | null;
  height?: string;
}

const NODE_COLORS: Record<string, string> = {
  Program: 'bg-blue-100 text-blue-800 border-blue-300',
  FunctionDeclaration: 'bg-violet-100 text-violet-800 border-violet-300',
  ClassDeclaration: 'bg-violet-100 text-violet-800 border-violet-300',
  ForStatement: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ForOfStatement: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  WhileStatement: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  IfStatement: 'bg-amber-100 text-amber-800 border-amber-300',
  SwitchStatement: 'bg-amber-100 text-amber-800 border-amber-300',
  TryStatement: 'bg-rose-100 text-rose-800 border-rose-300',
  ReturnStatement: 'bg-sky-100 text-sky-800 border-sky-300',
  VariableDeclarator: 'bg-slate-100 text-slate-700 border-slate-300',
  Variable: 'bg-slate-100 text-slate-700 border-slate-300',
  Declaration: 'bg-slate-100 text-slate-700 border-slate-300',
  CallExpression: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
};

function colorFor(type: string): string {
  return NODE_COLORS[type] || 'bg-slate-50 text-slate-600 border-slate-200';
}

function nodeMatches(node: IAstNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    node.type.toLowerCase().includes(q) ||
    node.label.toLowerCase().includes(q) ||
    node.children.some(c => nodeMatches(c, query))
  );
}

function collectLines(node: IAstNode, acc: Set<number>): void {
  if (node.loc) acc.add(node.loc.startLine);
  for (const c of node.children) collectLines(c, acc);
}

export function AstTreeView({ tree, onSelectNode, highlightedLine, height = '420px' }: AstTreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Reverse sync: highlight node whose range covers the editor's current line
  const lineToNode = useMemo(() => {
    const map = new Map<number, IAstNode>();
    const walkTree = (node: IAstNode, deepest: boolean) => {
      if (node.loc) {
        // Prefer the deepest node for a line
        const existing = map.get(node.loc.startLine);
        if (!existing || nodeContains(existing, node)) map.set(node.loc.startLine, node);
      }
      for (const c of node.children) walkTree(c, deepest);
    };
    walkTree(tree, true);
    return map;
  }, [tree]);

  const matchedNode = useMemo(() => {
    if (highlightedLine == null) return null;
    return lineToNode.get(highlightedLine) || null;
  }, [highlightedLine, lineToNode]);

  useEffect(() => {
    if (matchedNode) setSelectedId(matchedNode.id);
  }, [matchedNode]);

  const matchesQuery = query === '' || nodeMatches(tree, query);

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (node: IAstNode) => {
    setSelectedId(node.id);
    onSelectNode?.(node);
  };

  const visibleCount = useMemo(() => {
    let count = 0;
    const walkTree = (n: IAstNode) => {
      if (nodeMatches(n, query)) count++;
      for (const c of n.children) walkTree(c);
    };
    walkTree(tree);
    return count;
  }, [tree, query]);

  const renderNode = (node: IAstNode, depth: number): React.ReactNode => {
    if (!nodeMatches(node, query)) return null;
    const isCollapsed = collapsed.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;
    const highlighted = matchedNode?.id === node.id;

    return (
      <div key={node.id} style={{ marginLeft: depth === 0 ? 0 : 16 }}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          tabIndex={0}
          onClick={() => handleSelect(node)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelect(node);
            } else if (e.key === 'ArrowRight' && hasChildren && isCollapsed) toggle(node.id);
            else if (e.key === 'ArrowLeft' && hasChildren && !isCollapsed) toggle(node.id);
          }}
          className={`group flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer border transition-colors ${
            isSelected
              ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300'
              : highlighted
                ? 'bg-amber-50 border-amber-300'
                : 'border-transparent hover:bg-slate-50'
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? `Expand ${node.type}` : `Collapse ${node.type}`}
              onClick={e => { e.stopPropagation(); toggle(node.id); }}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-500"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-[22px]" />
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-mono border ${colorFor(node.type)}`}>
            {node.type}
          </span>
          <span className="text-xs text-slate-600 truncate max-w-[240px]">{node.label}</span>
          {node.loc && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
              <Hash className="w-3 h-3" />
              {node.loc.startLine}
              {node.loc.endLine > node.loc.startLine ? `-${node.loc.endLine}` : ''}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && node.children.map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const find = (n: IAstNode): IAstNode | null => {
      if (n.id === selectedId) return n;
      for (const c of n.children) {
        const found = find(c);
        if (found) return found;
      }
      return null;
    };
    return find(tree);
  }, [selectedId, tree]);

  return (
    <div className="flex flex-col border rounded-lg bg-white" style={{ height }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 rounded-t-lg">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter nodes by type or label…"
          aria-label="Filter AST nodes"
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-slate-400"
        />
        <span className="text-[11px] text-slate-400">{visibleCount} nodes</span>
      </div>
      <div className="flex-1 overflow-auto p-2" role="tree" aria-label="Abstract Syntax Tree">
        {matchesQuery ? (
          renderNode(tree, 0)
        ) : (
          <p className="text-xs text-slate-400 p-3">No nodes match "{query}".</p>
        )}
      </div>
      {selectedNode && (
        <div className="border-t px-3 py-2 bg-slate-50 rounded-b-lg text-xs space-y-0.5">
          <p><span className="font-semibold text-slate-700">Type:</span> <span className="font-mono">{selectedNode.type}</span></p>
          <p><span className="font-semibold text-slate-700">Label:</span> {selectedNode.label}</p>
          {selectedNode.loc && (
            <p><span className="font-semibold text-slate-700">Lines:</span> {selectedNode.loc.startLine}{selectedNode.loc.endLine > selectedNode.loc.startLine ? `–${selectedNode.loc.endLine}` : ''}</p>
          )}
          <p><span className="font-semibold text-slate-700">Children:</span> {selectedNode.children.length}</p>
        </div>
      )}
    </div>
  );
}

/** Returns true if `a` contains `b` spatially (used to keep the deepest node per line). */
function nodeContains(a: IAstNode, b: IAstNode): boolean {
  if (!a.loc || !b.loc) return false;
  return (
    a.loc.startLine <= b.loc.startLine &&
    a.loc.endLine >= b.loc.endLine &&
    (a.loc.endLine - a.loc.startLine) > (b.loc.endLine - b.loc.startLine)
  );
}
