// Structural schemas derived from canonical TS types; domain validation stays in the Core.
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const source = fileURLToPath(new URL("../contracts/mcp.ts", import.meta.url));
const target = fileURLToPath(new URL("../contracts/mcp.v1.schema.json", import.meta.url));
export function generateMcpSchemas() {
  const program = ts.createProgram([source], { strict: true, target: ts.ScriptTarget.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true });
  const errors = ts.getPreEmitDiagnostics(program);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: x => x, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n" }));
  const checker = program.getTypeChecker();
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(source)));
  const definitions = {}, seen = new Map();
  function schema(type) {
    if (type.flags & ts.TypeFlags.Undefined) throw new Error("Unexpected undefined in wire type");
    if (type.flags & ts.TypeFlags.Null) return { type: "null" };
    if (type.isStringLiteral() || type.isNumberLiteral()) return { const: type.value };
    if (type.flags & ts.TypeFlags.BooleanLiteral) return { const: type.intrinsicName === "true" };
    if (type.flags & ts.TypeFlags.String) return { type: "string" };
    if (type.flags & ts.TypeFlags.Number) return { type: "number" };
    if (type.flags & ts.TypeFlags.Boolean) return { type: "boolean" };
    if (type.isUnion()) return { anyOf: type.types.filter(t => !(t.flags & ts.TypeFlags.Undefined)).map(schema) };
    if (checker.isArrayType(type)) return { type: "array", items: schema(checker.getTypeArguments(type)[0]) };
    if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) throw new Error(`Unsupported type: ${checker.typeToString(type)}`);
    if (seen.has(type.id)) return { $ref: `#/definitions/${seen.get(type.id)}` };
    const name = `T${seen.size + 1}`;
    seen.set(type.id, name);
    const properties = {}, required = [];
    const indexType = checker.getIndexTypeOfType(type, ts.IndexKind.String);
    definitions[name] = { type: "object", properties, required, additionalProperties: indexType ? schema(indexType) : false };
    for (const prop of checker.getPropertiesOfType(type)) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration ?? prop.declarations[0]);
      const optional = Boolean(prop.flags & ts.SymbolFlags.Optional);
      // Remove undefined only; null remains part of the wire contract.
      const parts = propType.isUnion() ? propType.types.filter(t => !(t.flags & ts.TypeFlags.Undefined)) : null;
      properties[prop.name] = parts ? (parts.length === 1 ? schema(parts[0]) : { anyOf: parts.map(schema) }) : schema(propType);
      if (!optional) required.push(prop.name);
    }
    return { $ref: `#/definitions/${name}` };
  }
  const tools = {};
  for (const [typeName, field] of [["McpInputs", "inputSchema"], ["McpOutputs", "outputSchema"]]) {
    const symbol = exports.find(s => s.name === typeName);
    for (const prop of checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))) {
      tools[prop.name] ??= {};
      tools[prop.name][field] = schema(checker.getTypeOfSymbolAtLocation(prop, prop.declarations[0]));
    }
  }
  // IDs are opaque, bounded and untrimmed. Core remains responsible for identity semantics.
  for (const tool of Object.values(tools)) {
    const input = definitions[tool.inputSchema.$ref.split("/").at(-1)];
    for (const key of ["id", "companyId", "assetId"]) if (input.properties[key]) input.properties[key] = { type: "string", minLength: 1, maxLength: 512, pattern: "^\\S(?:[\\s\\S]*\\S)?$" };
  }
  return { $schema: "http://json-schema.org/draft-07/schema#", title: "Investment OS MCP 1.0.0", contractVersion: "1.0.0", tools, definitions };
}
const serialized = () => `${JSON.stringify(generateMcpSchemas(), null, 2)}\n`;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    if (readFileSync(target, "utf8") !== serialized()) throw new Error("MCP schemas drifted; regenerate and review version compatibility");
  } else writeFileSync(target, serialized());
}
