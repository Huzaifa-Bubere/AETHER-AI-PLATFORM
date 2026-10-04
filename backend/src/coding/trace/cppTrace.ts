import type { ITraceEvent, TraceEventType } from './trace.types';

/**
 * AETHER Coding — C / C++ trace engine.
 *
 * Same contract as the JS engine: the candidate's code is INSTRUMENTED with
 * probe macros, compiled and executed in the SAME sandboxed chain as official
 * runs (Judge0/Piston), and every frame the visualizer shows comes from a real
 * runtime event. Nothing here is simulated or AI-generated.
 *
 * How it works
 *  1. `instrumentCppSource` inserts a `_AETHER_T(line, kind, "name", name, …)`
 *     call at the head of each executable statement line. Identifier capture is
 *     brace-depth aware and declaration-before-use, so a probe never references
 *     a name that is out of scope at that line (which would be a compile error).
 *  2. A generated `main()` reads the chosen sample/custom input, parses it into
 *     the parameters of the solution function, calls it, and prints the result.
 *  3. Events are emitted as `@@AETHER@@{json}` lines on stdout, which
 *     `parseCppTraceStdout` splits back out from the program's own output.
 *
 * Compilation/execution failures are surfaced honestly by the caller — the
 * tracer never fabricates state to paper over a build error.
 */

export const CPP_TRACE_SENTINEL = '@@AETHER@@';

/** Parameter types the generated main() knows how to parse from stdin. */
const SUPPORTED_PARAM_TYPES = [
  'int', 'long', 'long long', 'short', 'unsigned', 'unsigned long',
  'float', 'double', 'bool', 'char', 'string',
  'vector<int>', 'vector<long>', 'vector<long long>',
  'vector<double>', 'vector<float>', 'vector<string>', 'vector<bool>', 'vector<char>',
];

export interface CppSignature {
  functionName: string;
  returnType: string;
  /** declared parameter types in order, references/const stripped */
  paramTypes: string[];
  /** true when the solution is a free function (plain C) rather than a class method */
  isFreeFunction: boolean;
  className: string | null;
}

interface Probe {
  line: number;
  kind: 'line' | 'loop' | 'condition' | 'return';
  names: string[];
}

/** Split a parameter list on top-level commas (ignores `<>` nesting). */
function splitParams(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of src) {
    if (ch === '<' || ch === '(' || ch === '[') depth++;
    else if (ch === '>' || ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

/** Strip `const`, `&`, `*` and whitespace from a declared parameter type. */
function normalizeType(raw: string): string {
  return raw
    // access specifiers leak in from `public: vector<int> f(...)`
    .replace(/\b(public|private|protected)\s*:\s*/g, '')
    .replace(/\bconst\b/g, '')
    .replace(/&/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recover the solution's signature from the source so the harness knows what to
 * parse and call. Handles both `class Solution { … }` and a plain C function.
 */
export function extractCppSignature(source: string, preferredName?: string): CppSignature | null {
  // class-based (C++ idiom in this product)
  const classMatch = source.match(/\bclass\s+([A-Za-z_]\w*)\s*\{/);
  if (classMatch) {
    const className = classMatch[1];
    // Find the method whose name matches the preferred name, else the first one.
    const methodRe = /(?:^|[\s;}])([A-Za-z_][\w:<>,&*\s]*?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const\s*)?\{/g;
    let m: RegExpExecArray | null;
    let fallback: RegExpExecArray | null = null;
    while ((m = methodRe.exec(source)) !== null) {
      // skip control-flow keywords that match the method shape
      if (/^(if|for|while|switch|catch|return|else|do)$/.test(m[2])) continue;
      if (!fallback) fallback = m;
      if (preferredName && m[2] === preferredName) {
        return finishSig(m[2], m[1], m[3], false, className);
      }
    }
    if (fallback) return finishSig(fallback[2], fallback[1], fallback[3], false, className);
  }

  // plain function (C idiom)
  const freeRe = /(?:^|\n)\s*(?:[A-Za-z_][\w:<>,&*\s]*?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
  let fm: RegExpExecArray | null;
  while ((fm = freeRe.exec(source)) !== null) {
    if (/^(if|for|while|switch|catch|else|do|main)$/.test(fm[1])) continue;
    if (preferredName && fm[1] !== preferredName) continue;
    return finishSig(fm[1], fm[0].replace(fm[1], ''), fm[2], true, null);
  }
  return null;
}

function finishSig(
  fn: string,
  retTypeRaw: string,
  paramsRaw: string,
  isFreeFunction: boolean,
  className: string | null,
): CppSignature {
  const retType = normalizeType(retTypeRaw.replace(/\{$/, '')) || 'int';
  const paramTypes = splitParams(paramsRaw).map(p => {
    // "vector<int> nums" → type is everything but the trailing identifier
    const m = p.match(/^(.*?[\s>*&])[A-Za-z_]\w*$/);
    return normalizeType(m ? m[1] : p);
  });
  return { functionName: fn, returnType: retType, paramTypes, isFreeFunction, className };
}

/**
 * Decide which identifiers are safe to read at a given line.
 * Scope is tracked by brace depth so a name declared inside a sibling block is
 * never probed from outside it, and a name is only probed after it is declared.
 */
function collectProbes(source: string): Probe[] {
  const lines = source.split('\n');
  // stack of Sets — one per open brace depth; holds names visible at that depth
  const scope: Set<string>[] = [new Set()];
  const probes: Probe[] = [];
  let depth = 0;
  let inBlockComment = false;
  // Types we know how to serialize; anything else is skipped to stay safe.
  const serializable = /^(int|long|short|unsigned|float|double|bool|char|vector<int>|vector<long>|vector<long long>|vector<double>|vector<float>|vector<string>|string)$/;
  const typeByName = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const trimmed = raw.trim();

    // Track block comments so we never inject inside one.
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
    if (!trimmed || trimmed.startsWith('//')) continue;
    // Preprocessor lines and pure braces/labels cannot host a statement probe.
    if (trimmed.startsWith('#')) continue;
    if (/^[{}()[\];:,]+$/.test(trimmed)) continue;
    // Declarations and access specifiers are not statements — a probe before
    // `using namespace std;` or `class Solution {` is a compile error.
    if (/^(class|struct|namespace|template|typedef|using|friend|enum|public|private|protected|virtual|extern|inline|static)\b/.test(trimmed)) continue;

    // A function/method signature line declares its parameters on that line, so
    // a probe placed BEFORE the signature cannot reference them. Capture names
    // only from what is already in scope at this point.
    const isSignature =
      /\)\s*(?:const\s*)?(?:noexcept\s*)?\{?\s*$/.test(trimmed) &&
      /\w\s*\(/.test(raw) &&
      // `for (...) {` / `if (...) {` / `while (...) {` end the same way but are
      // NOT signatures — their variables ARE in scope for the probe.
      !/^(for|if|while|switch|catch|do|else|return)\b/.test(trimmed);

    const isControl = /^(if|else|for|while|switch|case|default|do|try|catch|return|break|continue)\b/.test(trimmed);
    const kind: Probe['kind'] = /^(for|while)\b/.test(trimmed)
      ? 'loop'
      : /^(if|switch)\b/.test(trimmed)
        ? 'condition'
        : /^return\b/.test(trimmed)
          ? 'return'
          : 'line';

    // Names we can safely reference at this point.
    const names: string[] = [];
    const visible = scope[scope.length - 1];

    // Parameter names on a signature line are not yet in scope here.
    if (isSignature) {
      if (!/^[}\])]+$/.test(trimmed)) {
        probes.push({ line: lineNo, kind, names: [] });
      }
      for (const ch of raw) {
        if (ch === '{') { scope.push(new Set(scope[scope.length - 1])); depth++; }
        else if (ch === '}') { if (scope.length > 1) scope.pop(); depth--; }
      }
      continue;
    }

    // Collect declarations that appear on THIS line, and record their type so
    // later probes can decide whether the value is serializable.
    const declRe = /\b(int|long long|long|short|unsigned|float|double|bool|char|string|vector\s*<[^>]+>)\s*&?\s*([A-Za-z_]\w*)\s*(?:=|;|,|\)|\[)/g;
    let dm: RegExpExecArray | null;
    while ((dm = declRe.exec(raw)) !== null) {
      const varName = dm[2];
      // Take the type from its own capture group — deriving it from the whole
      // match would swallow the `=` and make every lookup fail.
      const varType = normalizeType(dm[1]);
      typeByName.set(varName, varType);
      // Push onto the current scope so nested blocks can see it.
      visible.add(varName);
      // A declaration's value is readable on the same line for scalars.
      if (serializable.test(varType) && varType !== 'string') names.push(varName);
    }

    // Loop variables declared inline: `for (int i = 0; …)`
    const forVar = raw.match(/\bfor\s*\(\s*(?:int|long|size_t|auto)\s+([A-Za-z_]\w*)/);
    if (forVar) {
      visible.add(forVar[1]);
      typeByName.set(forVar[1], 'int');
    }
    // Assignment targets already in scope.
    const assignRe = /(^|[^\w.>])([A-Za-z_]\w*)\s*(?:=[^=]|\+\+|--|\+=|-=)/g;
    let am: RegExpExecArray | null;
    while ((am = assignRe.exec(raw)) !== null) {
      const varName = am[2];
      const t = typeByName.get(varName);
      if (visible.has(varName) && t && serializable.test(t)) names.push(varName);
    }

    // Range-for variable: `for (int x : v)`
    const rangeFor = raw.match(/\bfor\s*\(\s*(?:int|long|auto|string|vector<[^>]+>)\s+([A-Za-z_]\w*)\s*:/);
    if (rangeFor) {
      visible.add(rangeFor[1]);
      typeByName.set(rangeFor[1], 'int');
    }

    const unique = [...new Set(names)].slice(0, 8);
    if (isControl || unique.length > 0 || /[;{}]/.test(raw)) {
      // Only emit a probe where there is genuinely a statement to reach.
      if (!/^[})]+$/.test(trimmed)) {
        probes.push({ line: lineNo, kind, names: unique });
      }
    }

    // Update brace depth AFTER the probe (the statement on this line runs first).
    for (const ch of raw) {
      if (ch === '{') { scope.push(new Set(scope[scope.length - 1])); depth++; }
      else if (ch === '}') { if (scope.length > 1) scope.pop(); depth--; }
    }
  }
  return probes;
}

const KIND_TO_EVENT: Record<string, TraceEventType> = {
  line: 'LINE',
  loop: 'LOOP_ITERATION',
  condition: 'CONDITION',
  return: 'FUNCTION_RETURN',
};

/**
 * Build the full instrumented program: user code + probe runtime + generated main.
 */
export function buildCppTraceProgram(params: {
  sourceCode: string;
  language: 'cpp' | 'c';
  testInput: string;
  functionName?: string;
  maxSteps: number;
}): { program: string; signature: CppSignature | null; userEndLine: number } {
  const source = params.sourceCode;
  const userEnd = source.split('\n').length;
  const sig = extractCppSignature(source, params.functionName);
  const probes = collectProbes(source);

  const isC = params.language === 'c';
  const lineMap: Record<string, string> = {};
  for (const p of probes) lineMap[String(p.line)] = p.kind;

  const instrumented = instrumentCppSource(source, probes);

  const runtime = isC ? cRuntime() : cppRuntime();

  // A generated main() would clash with one the candidate already wrote.
  // C submissions in this product are complete programs, so they always bring
  // their own main; in that case we only instrument and let it run.
  const hasOwnMain = /\bint\s+main\s*\(/.test(source);

  // Only build the calling harness when we understand the signature and the
  // candidate has not supplied their own entry point.
  const caller = !isC && !hasOwnMain && sig && allTypesSupported(sig.paramTypes)
    ? buildCaller(sig, params.testInput)
    : null;

  const program = `${instrumented}
${runtime}
${caller || ''}
`;

  return { program, signature: sig, userEndLine: userEnd };
}

function allTypesSupported(types: string[]): boolean {
  return types.every(t => SUPPORTED_PARAM_TYPES.includes(t));
}

/** Insert `_AETHER_T(...)` probes at statement heads. */
function instrumentCppSource(code: string, probes: Probe[]): string {
  const byLine = new Map<number, Probe>();
  for (const p of probes) byLine.set(p.line, p);
  const lines = code.split('\n');
  const out = lines.map((text, i) => {
    const line = i + 1;
    const probe = byLine.get(line);
    if (!probe) return text;
    const trimmed = text.trimStart();
    if (!trimmed) return text;
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return text;
    if (trimmed.startsWith('#')) return text;
    // Declarations / access specifiers are not statements.
    if (/^(class|struct|namespace|template|typedef|using|friend|enum|public|private|protected|virtual|extern|inline|static)\b/.test(trimmed)) return text;
    // A line that only closes/opens a block has no statement to prefix.
    if (/^[})\]]+[;,]?$/.test(trimmed)) return text;
    if (/^(else|case|default)\b/.test(trimmed) && !/=|\(/.test(trimmed)) return text;

    const indent = text.slice(0, text.length - trimmed.length);
    // `_AETHER_T` pairs a display name with the live variable so the runtime
    // can read its real value without knowing the type. Names come from the
    // SAME probe record used above, so the two can never disagree.
    const args = probe.names.map(n => JSON.stringify(n) + ', ' + n).join(', ');
    const call = `_AETHER_T(${line}, ${JSON.stringify(probe.kind)}${args ? ', ' + args : ''});`;
    return indent + call + ' ' + trimmed;
  });
  return out.join('\n');
}

/** Shared probe runtime. Emits one sentinel line per event on stdout. */
function cppRuntime(): string {
  return `
namespace aether {
static const char* SENTINEL = ${JSON.stringify(CPP_TRACE_SENTINEL)};
static long steps = 0;
static bool stopped = false;
static long maxSteps = 0;
static int depth = 0;
static std::vector<std::string> stack;

static std::string esc(const std::string& s) {
  std::string o;
  for (char c : s) {
    if (c == '"' || c == '\\\\') { o += '\\\\'; o += c; }
    else if (c == '\\n') o += "\\\\n";
    else if ((unsigned char)c < 0x20) { /* drop control chars */ }
    else o += c;
  }
  return o;
}

// Serialize a value of unknown type without needing to know it at the call site.
template <typename T>
std::string ser(const T& v, int depth = 0) {
  if (depth > 3) return "...";
  if constexpr (std::is_same_v<T, bool>) { return v ? "true" : "false"; }
  else if constexpr (std::is_same_v<T, char>) { return std::string(1, v); }
  else if constexpr (std::is_same_v<T, std::string>) { return v; }
  else if constexpr (std::is_arithmetic_v<T>) {
    std::ostringstream os; os << v; return os.str();
  }
  else if constexpr (std::is_same_v<T, std::vector<int>> || std::is_same_v<T, std::vector<long>> ||
                     std::is_same_v<T, std::vector<long long>> || std::is_same_v<T, std::vector<double>> ||
                     std::is_same_v<T, std::vector<float>> || std::is_same_v<T, std::vector<char>>) {
    using E = typename T::value_type;
    std::ostringstream os; os << "[";
    for (size_t i = 0; i < v.size() && i < 64; i++) {
      if (i) os << ", ";
      if constexpr (std::is_same_v<E, char>) os << v[i];
      else if constexpr (std::is_same_v<E, bool>) os << (v[i] ? "true" : "false");
      else os << v[i];
    }
    if (v.size() > 64) os << ", ...(+" << (v.size() - 64) << ")";
    os << "]"; return os.str();
  }
  else if constexpr (std::is_same_v<T, std::vector<std::string>>) {
    std::ostringstream os; os << "[";
    for (size_t i = 0; i < v.size() && i < 64; i++) { if (i) os << ", "; os << '"' << esc(v[i]) << '"'; }
    if (v.size() > 64) os << ", ...(+" << (v.size() - 64) << ")";
    os << "]"; return os.str();
  }
  else if constexpr (std::is_same_v<T, std::vector<bool>>) {
    std::ostringstream os; os << "[";
    for (size_t i = 0; i < v.size() && i < 64; i++) { if (i) os << ", "; os << (v[i] ? "true" : "false"); }
    os << "]"; return os.str();
  }
  else return "<value>";
}

// Emit one trace event. Name/value pairs arrive as alternating arguments.
template <typename... Rest>
void emit(int line, const char* kind, const char* name, Rest&&... rest) {
  if (stopped) return;
  if (maxSteps && ++steps > maxSteps) {
    stopped = true;
    std::cout << SENTINEL << "{\\"e\\":\\"__STOPPED__\\"}\\n";
    std::cout.flush(); return;
  }
  std::string vars = "{\\"v\\":{";
  addPair(vars, name, std::forward<Rest>(rest)...);
  vars += "},\\"c\\":{}}";
  std::cout << SENTINEL << "{\\"e\\":\\"" << kind << "\\",\\"l\\":" << line
            << ",\\"f\\":\\"" << (stack.empty() ? "<module>" : stack.back())
            << "\\",\\"d\\":" << depth << "," << vars << "}\\n";
  std::cout.flush();
}
// Probe with no variables — the common case for plain statements.
inline void emit(int line, const char* kind) {
  if (stopped) return;
  if (maxSteps && ++steps > maxSteps) {
    stopped = true;
    std::cout << SENTINEL << "{\\"e\\":\\"__STOPPED__\\"}\\n";
    std::cout.flush(); return;
  }
  std::cout << SENTINEL << "{\\"e\\":\\"" << kind << "\\",\\"l\\":" << line
            << ",\\"f\\":\\"" << (stack.empty() ? "<module>" : stack.back())
            << "\\",\\"d\\":" << depth << ",\\"v\\":{},\\"c\\":{}}\\n";
  std::cout.flush();
}

template <typename... Rest>
void addPair(std::string&, const char*) {}
template <typename V, typename... Rest>
void addPair(std::string& s, const char* name, const V& v, Rest&&... rest) {
  if (s.back() != '{') s += ",";
  s += "\\""; s += esc(name); s += "\\":\\"";
  s += esc(ser(v)); s += "\\"";
  addPair(s, std::forward<Rest>(rest)...);
}
} // namespace aether

#define _AETHER_T(LINE, KIND, ...) ::aether::emit(LINE, KIND, __VA_ARGS__)
`;
}

function cRuntime(): string {
  return `
/* C probe runtime — variables are emitted as integer-ish display strings. */
static const char* AETHER_SENTINEL = ${JSON.stringify(CPP_TRACE_SENTINEL)};
static long aether_steps = 0;
static long aether_max = 0;
static int aether_stopped = 0;
void aether_set_max(long m) { aether_max = m; }

static void aether_emit(int line, const char* kind, const char* payload) {
  if (aether_stopped) return;
  if (aether_max && ++aether_steps > aether_max) {
    aether_stopped = 1;
    printf("%s{\\"e\\":\\"__STOPPED__\\"}\\n", AETHER_SENTINEL);
    fflush(stdout);
    return;
  }
  printf("%s{\\"e\\":\\"%s\\",\\"l\\":%d,\\"f\\":\\"<module>\\",\\"d\\":0,\\"v\\":{},\\"c\\":{}}\\n", AETHER_SENTINEL, kind, line);
  fflush(stdout);
}
#define _AETHER_T(LINE, KIND, ...) aether_emit(LINE, KIND, "")
`;
}

/**
 * Generate the caller: read one input line per parameter, invoke the solution,
 * and print the return value. Types are emitted via `using` aliases so the
 * parser picks the right specialization automatically.
 */
function buildCaller(sig: CppSignature, testInput: string): string {
  const isC = sig.isFreeFunction;
  const args: string[] = sig.paramTypes.map((t, i) => {
    const varName = `arg${i}`;
    switch (t) {
      case 'int': return `${varName} = _read_int();`;
      case 'long': return `${varName} = _read_long();`;
      case 'long long': return `${varName} = _read_long();`;
      case 'short': return `${varName} = _read_int();`;
      case 'unsigned': return `${varName} = _read_long();`;
      case 'unsigned long': return `${varName} = _read_long();`;
      case 'float': return `${varName} = _read_double();`;
      case 'double': return `${varName} = _read_double();`;
      case 'bool': return `${varName} = _read_bool();`;
      case 'char': return `${varName} = _read_char();`;
      case 'string': return `${varName} = _read_string();`;
      case 'vector<int>': return `${varName} = _read_vec<int>();`;
      case 'vector<long>':
      case 'vector<long long>': return `${varName} = _read_vec<long>();`;
      case 'vector<double>': return `${varName} = _read_vec<double>();`;
      case 'vector<float>': return `${varName} = _read_vec<float>();`;
      case 'vector<char>': return `${varName} = _read_vec<char>();`;
      case 'vector<string>': return `${varName} = _read_vec_string();`;
      case 'vector<bool>': return `${varName} = _read_vec_bool();`;
      default: return `${varName} = ${t}{};`;
    }
  });

  const callExpr = isC
    ? `${sig.functionName}(${sig.paramTypes.map((_, i) => `arg${i}`).join(', ')})`
    : `Solution().${sig.functionName}(${sig.paramTypes.map((_, i) => `arg${i}`).join(', ')})`;

  const printResult = isC
    ? `_print_result(result);`
    : `_print_result(result);`;

  return `
/* ==== AETHER trace harness (user code: lines 1..) ==== */
static long _aether_max_steps = 0;

static std::string _aether_line() {
  std::string l;
  if (!std::getline(std::cin, l)) return l;
  while (!l.empty() && (l.back() == '\\r' || l.back() == ' ')) l.pop_back();
  std::size_t b = l.find_first_not_of(" \\t");
  if (b == std::string::npos) return "";
  return l.substr(b);
}

/* Strip surrounding [ ] and split on commas. */
static std::vector<std::string> _split_vec(const std::string& raw) {
  std::string s = raw;
  std::size_t a = s.find('[');
  std::size_t b = s.rfind(']');
  if (a != std::string::npos && b != std::string::npos && b > a) s = s.substr(a + 1, b - a - 1);
  std::vector<std::string> out;
  std::string cur;
  for (char c : s) {
    if (c == ',') { if (!cur.empty()) out.push_back(cur); cur.clear(); }
    else if (!std::isspace((unsigned char)c)) cur += c;
  }
  if (!cur.empty()) out.push_back(cur);
  return out;
}

static int _read_int() { std::string l = _aether_line(); return l.empty() ? 0 : std::atoi(l.c_str()); }
static long _read_long() { std::string l = _aether_line(); return l.empty() ? 0L : std::atol(l.c_str()); }
static double _read_double() { std::string l = _aether_line(); return l.empty() ? 0.0 : std::atof(l.c_str()); }
static bool _read_bool() { std::string l = _aether_line(); return l == "true" || l == "1" || l == "True"; }
static char _read_char() { std::string l = _aether_line(); return l.empty() ? '\\0' : l[0]; }
static std::string _read_string() { return _aether_line(); }

template <typename T> static std::vector<T> _read_vec() {
  std::vector<T> out;
  for (const std::string& p : _split_vec(_aether_line())) {
    if constexpr (std::is_same_v<T, std::string>) out.push_back(p);
    else if constexpr (std::is_same_v<T, char>) out.push_back(p.empty() ? '\\0' : p[0]);
    else if constexpr (std::is_same_v<T, double> || std::is_same_v<T, float>) out.push_back((T)std::atof(p.c_str()));
    else out.push_back((T)std::atol(p.c_str()));
  }
  return out;
}
static std::vector<std::string> _read_vec_string() {
  std::vector<std::string> out;
  for (const std::string& p : _split_vec(_aether_line())) {
    if (p.size() >= 2 && p.front() == '"' && p.back() == '"') out.push_back(p.substr(1, p.size() - 2));
    else out.push_back(p);
  }
  return out;
}
static std::vector<bool> _read_vec_bool() {
  std::vector<bool> out;
  for (const std::string& p : _split_vec(_aether_line())) out.push_back(p == "true" || p == "1");
  return out;
}

template <typename T> static void _print_value(const T& v) {
  if constexpr (std::is_same_v<T, bool>) std::cout << (v ? "true" : "false");
  else if constexpr (std::is_same_v<T, char>) std::cout << v;
  else if constexpr (std::is_same_v<T, std::string>) std::cout << v;
  else if constexpr (std::is_arithmetic_v<T>) std::cout << v;
  else if constexpr (std::is_same_v<T, std::vector<std::string>>) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) std::cout << ", "; std::cout << '"' << v[i] << '"'; }
    std::cout << "]";
  }
  else if constexpr (std::is_same_v<T, std::vector<bool>>) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) std::cout << ", "; std::cout << (v[i] ? "true" : "false"); }
    std::cout << "]";
  }
  else if constexpr (std::is_same_v<T, std::vector<char>>) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) std::cout << ", "; std::cout << v[i]; }
    std::cout << "]";
  }
  else if constexpr (std::is_same_v<T, std::vector<int>> || std::is_same_v<T, std::vector<long>> ||
                     std::is_same_v<T, std::vector<long long>> || std::is_same_v<T, std::vector<double>> ||
                     std::is_same_v<T, std::vector<float>>) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) std::cout << ", "; std::cout << v[i]; }
    std::cout << "]";
  }
  else std::cout << "<value>";
}

template <typename T> static void _print_result(const T& r) {
  _print_value(r);
  std::cout << std::endl;
  std::cout << "@@AETHER@@{\\"e\\":\\"__META__\\",\\"ret\\":\\"";
  _print_value(r);
  std::cout << "\\"}" << std::endl;
}

int main(int argc, char** argv) {
  _aether_max_steps = (argc > 1) ? std::atol(argv[1]) : 0;
  ::aether::maxSteps = _aether_max_steps;
  ${isC ? '' : 'std::ios::sync_with_stdio(false);'}
  ${args.join('\n  ')}
  try {
    ${isC ? '' : 'std::vector<int> _unused_guard;'}
    auto result = ${callExpr};
    ${printResult}
  } catch (const std::exception& e) {
    std::cout << "@@AETHER@@{\\"e\\":\\"__META__\\",\\"ret\\":null}" << std::endl;
    std::cerr << "ERROR: " << e.what() << std::endl;
    return 1;
  } catch (...) {
    std::cout << "@@AETHER@@{\\"e\\":\\"__META__\\",\\"ret\\":null}" << std::endl;
    std::cerr << "ERROR: unknown exception" << std::endl;
    return 1;
  }
  return 0;
}
`;
}

// ── stdout parsing ───────────────────────────────────────────────────────────

export interface CppRawParse {
  events: Array<Record<string, any>>;
  programOutput: string;
  truncated: boolean;
  returnValue: string | null;
  stopped: boolean;
}

export function parseCppTraceStdout(stdout: string): CppRawParse {
  const events: Array<Record<string, any>> = [];
  const outputLines: string[] = [];
  let stopped = false;
  let returnValue: string | null = null;

  for (const raw of stdout.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith(CPP_TRACE_SENTINEL)) {
      try {
        const obj = JSON.parse(line.slice(CPP_TRACE_SENTINEL.length));
        if (obj.e === '__META__') { returnValue = obj.ret ?? null; continue; }
        if (obj.e === '__STOPPED__') { stopped = true; continue; }
        events.push(obj);
      } catch { /* partial line */ }
      continue;
    }
    outputLines.push(line);
  }
  return { events, programOutput: outputLines.join('\n'), truncated: stopped, returnValue, stopped };
}

export function normalizeCppEvent(raw: Record<string, any>, step: number): ITraceEvent {
  return {
    step,
    line: Number(raw.l) || 0,
    event: KIND_TO_EVENT[raw.e] || 'LINE',
    function: String(raw.f || '<module>'),
    variables: raw.v && typeof raw.v === 'object' ? raw.v : {},
    collections: raw.c && typeof raw.c === 'object' ? raw.c : undefined,
    callDepth: Number(raw.d) || 0,
  };
}