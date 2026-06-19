import os
from typing import Dict, List, Any, Optional
from tree_sitter import Language, Parser, Node, QueryCursor

# Import pre-compiled grammar packages
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
import tree_sitter_go as tsgo

class ASTParser:
    """Parses code files using Tree-sitter to extract architectural relationships."""
    
    def __init__(self):
        self.languages: Dict[str, Language] = {}
        try:
            self.languages["python"] = Language(tspython.language())
            self.languages["javascript"] = Language(tsjavascript.language())
            self.languages["typescript"] = Language(tstypescript.language_typescript())
            self.languages["tsx"] = Language(tstypescript.language_tsx())
            self.languages["go"] = Language(tsgo.language())
        except Exception as e:
            print(f"Error loading tree-sitter language packages: {e}")

    def _get_language_for_file(self, filepath: str) -> Optional[str]:
        """Resolves the grammar language based on file extension."""
        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".py":
            return "python"
        elif ext in {".js", ".jsx", ".mjs"}:
            return "javascript"
        elif ext == ".ts":
            return "typescript"
        elif ext == ".tsx":
            return "tsx"
        elif ext == ".go":
            return "go"
        return None

    def _run_query(self, lang: Language, query_str: str, root_node: Node) -> Dict[str, List[Node]]:
        """Runs a tree-sitter query and returns a dict mapping capture name to lists of Node objects."""
        try:
            from tree_sitter import Query
            query = Query(lang, query_str)
            cursor = QueryCursor(query)
            return cursor.captures(root_node)
        except Exception as e:
            print(f"Failed to execute Tree-sitter query: {e}")
            return {}

    def parse_file(self, filepath: str) -> Optional[Dict[str, Any]]:
        """Parses a file and extracts key syntactic structures for the Software Nervous System."""
        lang_name = self._get_language_for_file(filepath)
        if not lang_name or lang_name not in self.languages:
            return None
            
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                code = f.read()
        except Exception as e:
            print(f"Failed to read file {filepath}: {e}")
            return None

        lang = self.languages[lang_name]
        parser = Parser(lang)
        tree = parser.parse(bytes(code, "utf8"))
        root_node = tree.root_node
        
        # Comprehensive extraction for dense graph
        extracted_data = {
            "imports": self._extract_imports(root_node, lang_name, lang, code),
            "exports": self._extract_exports(root_node, lang_name, lang, code),
            "classes": self._extract_classes(root_node, lang_name, lang, code),
            "functions": self._extract_functions(root_node, lang_name, lang, code),
            "calls": self._extract_calls(root_node, lang_name, lang, code),
            "api_endpoints": self._extract_api_endpoints(root_node, lang_name, lang, code),
            "db_models": self._extract_db_models(root_node, lang_name, lang, code),
            "hooks": self._extract_hooks(root_node, lang_name, lang, code),
            "middleware": self._extract_middleware(root_node, lang_name, lang, code)
        }
        
        return extracted_data

    def _extract_exports(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Extracts symbols exported by this file (JS/TS only for now)."""
        exports = []
        if lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (export_statement) @export
            (export_specifier) @export
            """
            captures = self._run_query(lang, query_str, root_node)
            for node in captures.get("export", []):
                exports.append({
                    "name": code[node.start_byte:node.end_byte].strip(),
                    "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                })
        return exports

    def _extract_api_endpoints(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Detects API route definitions (e.g. @app.get, router.post)."""
        endpoints = []
        if lang_name == "python":
            # FastAPI style: @app.get("/path")
            query_str = """
            (decorator
              (call
                function: (attribute
                  object: (identifier) @app
                  attribute: (identifier) @method
                )
                arguments: (argument_list (string) @path)
              )
            ) @endpoint
            """
            captures = self._run_query(lang, query_str, root_node)
            endpoint_nodes = captures.get("endpoint", [])
            paths = captures.get("path", [])
            methods = captures.get("method", [])
            
            for idx, node in enumerate(endpoint_nodes):
                path = code[paths[idx].start_byte:paths[idx].end_byte].strip("\"'") if idx < len(paths) else "/"
                method = code[methods[idx].start_byte:methods[idx].end_byte].upper() if idx < len(methods) else "GET"
                endpoints.append({
                    "path": path,
                    "method": method,
                    "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                })
                
        elif lang_name in {"javascript", "typescript", "tsx"}:
            # Express style: app.get('/path', ...)
            query_str = """
            (call_expression
              function: (member_expression
                object: (identifier) @app
                property: (property_identifier) @method
              )
              arguments: (arguments (string) @path)
            ) @endpoint
            """
            # Filter for common methods to reduce false positives
            captures = self._run_query(lang, query_str, root_node)
            endpoint_nodes = captures.get("endpoint", [])
            paths = captures.get("path", [])
            methods = captures.get("method", [])
            
            for idx, node in enumerate(endpoint_nodes):
                method = code[methods[idx].start_byte:methods[idx].end_byte].upper()
                if method in {"GET", "POST", "PUT", "DELETE", "PATCH", "USE"}:
                    path = code[paths[idx].start_byte:paths[idx].end_byte].strip("\"'")
                    endpoints.append({
                        "path": path,
                        "method": method,
                        "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                    })
        return endpoints

    def _extract_db_models(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Detects database models (SQLAlchemy, Mongoose)."""
        models = []
        if lang_name == "python":
            # SQLAlchemy: class User(Base):
            query_str = """
            (class_definition
              superclasses: (argument_list (identifier) @base)
            ) @model
            """
            captures = self._run_query(lang, query_str, root_node)
            for node in captures.get("model", []):
                # Verify if it inherits from "Base" or "Model"
                is_likely_model = False
                for b in captures.get("base", []):
                    if b.start_byte >= node.start_byte and b.end_byte <= node.end_byte:
                        if code[b.start_byte:b.end_byte] in {"Base", "Model"}:
                            is_likely_model = True
                            break
                if is_likely_model:
                    # Find the class name
                    name_node = node.child_by_field_name("name")
                    if name_node:
                        models.append({
                            "name": code[name_node.start_byte:name_node.end_byte],
                            "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                        })
        return models

    def _extract_hooks(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Detects custom hooks and built-in React hooks."""
        hooks = []
        if lang_name in {"javascript", "typescript", "tsx"}:
            # Detect function calls starting with 'use' or function definitions starting with 'use'
            query_str = """
            (function_declaration name: (identifier) @name) @hook
            (variable_declarator name: (identifier) @name value: (arrow_function)) @hook
            """
            captures = self._run_query(lang, query_str, root_node)
            for idx, node in enumerate(captures.get("hook", [])):
                name_node = captures.get("name", [])[idx]
                name = code[name_node.start_byte:name_node.end_byte]
                if name.startswith("use") and len(name) > 3 and name[3].isupper():
                    hooks.append({
                        "name": name,
                        "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                    })
        return hooks

    def _extract_middleware(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Detects middleware patterns (Express/FastAPI)."""
        middleware = []
        # (Heuristic-based detection, to be refined)
        return middleware

    def _extract_imports(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Extracts dependencies imported by this file."""
        imports = []
        
        if lang_name == "python":
            query_str = """
            (import_statement) @import
            (import_from_statement) @import
            """
            captures = self._run_query(lang, query_str, root_node)
            nodes = captures.get("import", [])
            for node in nodes:
                stmt_text = code[node.start_byte:node.end_byte].strip()
                imports.append({
                    "statement": stmt_text,
                    "type": "python_import",
                    "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                })
                
        elif lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (import_statement) @import
            """
            captures = self._run_query(lang, query_str, root_node)
            nodes = captures.get("import", [])
            for node in nodes:
                stmt_text = code[node.start_byte:node.end_byte].strip()
                imports.append({
                    "statement": stmt_text,
                    "type": "js_import",
                    "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                })
                
        elif lang_name == "go":
            query_str = """
            (import_spec) @import
            """
            captures = self._run_query(lang, query_str, root_node)
            nodes = captures.get("import", [])
            for node in nodes:
                stmt_text = code[node.start_byte:node.end_byte].strip()
                imports.append({
                    "statement": stmt_text,
                    "type": "go_import",
                    "range": [node.start_point[0] + 1, node.end_point[0] + 1]
                })
                
        return imports

    def _extract_classes(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Extracts class names and inheritance hierarchies."""
        classes = []
        
        if lang_name == "python":
            query_str = """
            (class_definition
              name: (identifier) @name
              superclasses: (argument_list)? @superclasses
            ) @class
            """
            captures = self._run_query(lang, query_str, root_node)
            class_nodes = captures.get("class", [])
            names = captures.get("name", [])
            superclasses = captures.get("superclasses", [])
            
            for class_node in class_nodes:
                class_name = ""
                for n in names:
                    if n.start_byte >= class_node.start_byte and n.end_byte <= class_node.end_byte:
                        class_name = code[n.start_byte:n.end_byte]
                        break
                        
                extends = []
                for s in superclasses:
                    if s.start_byte >= class_node.start_byte and s.end_byte <= class_node.end_byte:
                        supers = code[s.start_byte:s.end_byte].strip("()").split(",")
                        extends = [x.strip() for x in supers if x.strip()]
                        break
                
                if class_name:
                    classes.append({
                        "name": class_name,
                        "extends": extends,
                        "range": [class_node.start_point[0] + 1, class_node.end_point[0] + 1]
                    })
                    
        elif lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (class_declaration
              name: (identifier) @name
              heritage: (class_heritage
                (identifier) @extends
              )?
            ) @class
            """
            captures = self._run_query(lang, query_str, root_node)
            class_nodes = captures.get("class", [])
            names = captures.get("name", [])
            extends_nodes = captures.get("extends", [])
            
            for class_node in class_nodes:
                class_name = ""
                for n in names:
                    if n.start_byte >= class_node.start_byte and n.end_byte <= class_node.end_byte:
                        class_name = code[n.start_byte:n.end_byte]
                        break
                
                extends = []
                for e in extends_nodes:
                    if e.start_byte >= class_node.start_byte and e.end_byte <= class_node.end_byte:
                        extends.append(code[e.start_byte:e.end_byte])
                
                if class_name:
                    classes.append({
                        "name": class_name,
                        "extends": extends,
                        "range": [class_node.start_point[0] + 1, class_node.end_point[0] + 1]
                    })
                    
        return classes

    def _extract_functions(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Extracts function/method signatures, names, and parameters."""
        functions = []
        
        if lang_name == "python":
            query_str = """
            (function_definition
              name: (identifier) @name
              parameters: (parameters) @parameters
            ) @function
            """
            captures = self._run_query(lang, query_str, root_node)
            func_nodes = captures.get("function", [])
            names = captures.get("name", [])
            params = captures.get("parameters", [])
            
            for func_node in func_nodes:
                func_name = ""
                for n in names:
                    if n.start_byte >= func_node.start_byte and n.end_byte <= func_node.end_byte:
                        func_name = code[n.start_byte:n.end_byte]
                        break
                
                args = []
                for p in params:
                    if p.start_byte >= func_node.start_byte and p.end_byte <= func_node.end_byte:
                        param_str = code[p.start_byte:p.end_byte].strip("()")
                        args = [x.strip() for x in param_str.split(",") if x.strip()]
                        break
                        
                if func_name:
                    functions.append({
                        "name": func_name,
                        "args": args,
                        "range": [func_node.start_point[0] + 1, func_node.end_point[0] + 1]
                    })
                    
        elif lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (function_declaration
              name: (identifier) @name
            ) @func
            (method_definition
              name: (property_identifier) @name
            ) @func
            """
            captures = self._run_query(lang, query_str, root_node)
            func_nodes = captures.get("func", [])
            names = captures.get("name", [])
            
            for func_node in func_nodes:
                func_name = ""
                for n in names:
                    if n.start_byte >= func_node.start_byte and n.end_byte <= func_node.end_byte:
                        func_name = code[n.start_byte:n.end_byte]
                        break
                if func_name:
                    functions.append({
                        "name": func_name,
                        "range": [func_node.start_point[0] + 1, func_node.end_point[0] + 1]
                    })
                    
        elif lang_name == "go":
            query_str = """
            (function_declaration
              name: (identifier) @name
            ) @func
            (method_declaration
              name: (field_identifier) @name
            ) @func
            """
            captures = self._run_query(lang, query_str, root_node)
            func_nodes = captures.get("func", [])
            names = captures.get("name", [])
            
            for func_node in func_nodes:
                func_name = ""
                for n in names:
                    if n.start_byte >= func_node.start_byte and n.end_byte <= func_node.end_byte:
                        func_name = code[n.start_byte:n.end_byte]
                        break
                if func_name:
                    functions.append({
                        "name": func_name,
                        "range": [func_node.start_point[0] + 1, func_node.end_point[0] + 1]
                    })
                    
        return functions

    def _extract_calls(self, root_node: Node, lang_name: str, lang: Language, code: str) -> List[Dict[str, Any]]:
        """Extracts call sites within this file."""
        calls = []
        
        if lang_name == "python":
            query_str = """
            (call
              function: (identifier) @name
            )
            (call
              function: (attribute
                attribute: (identifier) @name
              )
            )
            """
            captures = self._run_query(lang, query_str, root_node)
            names = captures.get("name", [])
            for node in names:
                calls.append({
                    "target": code[node.start_byte:node.end_byte],
                    "line": node.start_point[0] + 1,
                    "start_byte": node.start_byte
                })
                
        elif lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (call_expression
              function: (identifier) @name
            )
            (call_expression
              function: (member_expression
                property: (property_identifier) @name
              )
            )
            """
            captures = self._run_query(lang, query_str, root_node)
            names = captures.get("name", [])
            for node in names:
                calls.append({
                    "target": code[node.start_byte:node.end_byte],
                    "line": node.start_point[0] + 1,
                    "start_byte": node.start_byte
                })
                
        # Sort chronologically by start byte position in source tree
        calls.sort(key=lambda x: x["start_byte"])
        # Clean up start_byte keys
        for c in calls:
            c.pop("start_byte", None)
            
        return calls

    def parse_function_flow(self, filepath: str, function_name: str) -> List[Dict[str, Any]]:
        """Extracts the control flow sequence of calls inside a specific function."""
        lang_name = self._get_language_for_file(filepath)
        if not lang_name or lang_name not in self.languages:
            return []
            
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                code = f.read()
        except Exception:
            return []

        lang = self.languages[lang_name]
        parser = Parser(lang)
        tree = parser.parse(bytes(code, "utf8"))
        root_node = tree.root_node
        
        # Step 1: Find the target function definition node
        target_func_node = None
        
        if lang_name == "python":
            query_str = """
            (function_definition
              name: (identifier) @name
            ) @func
            """
            captures = self._run_query(lang, query_str, root_node)
            func_nodes = captures.get("func", [])
            names = captures.get("name", [])
            
            for f_node in func_nodes:
                for n_node in names:
                    if n_node.parent == f_node:
                        name_text = code[n_node.start_byte:n_node.end_byte]
                        if name_text == function_name:
                            target_func_node = f_node
                            break
                if target_func_node:
                    break
                    
        elif lang_name in {"javascript", "typescript", "tsx"}:
            query_str = """
            (function_declaration
              name: (identifier) @name
            ) @func
            (method_definition
              name: (property_identifier) @name
            ) @func
            """
            captures = self._run_query(lang, query_str, root_node)
            func_nodes = captures.get("func", [])
            names = captures.get("name", [])
            
            for f_node in func_nodes:
                for n_node in names:
                    if n_node.parent == f_node:
                        name_text = code[n_node.start_byte:n_node.end_byte]
                        if name_text == function_name:
                            target_func_node = f_node
                            break
                if target_func_node:
                    break
                    
        if not target_func_node:
            return []
            
        # Step 2: Extract call statements inside the target function body node only
        calls = self._extract_calls(target_func_node, lang_name, lang, code)
        return calls

    def calculate_metrics(self, filepath: str) -> Dict[str, float]:
        """Calculates true AST-based complexity (cyclomatic approximation) and module coupling."""
        lang_name = self._get_language_for_file(filepath)
        # Fallback to simple heuristics if language is not supported or not parsed
        if not lang_name or lang_name not in self.languages:
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    complexity = min(10.0, max(0.1, len(lines) / 50.0))
                    import_count = sum(1 for line in lines if "import" in line or "require" in line)
                    coupling = min(10.0, max(0.1, import_count / 2.0))
                    return {"complexity": round(complexity, 1), "coupling": round(coupling, 1)}
            except Exception:
                return {"complexity": 1.0, "coupling": 1.0}
                
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                code = f.read()
        except Exception:
            return {"complexity": 1.0, "coupling": 1.0}

        lang = self.languages[lang_name]
        parser = Parser(lang)
        tree = parser.parse(bytes(code, "utf8"))
        root_node = tree.root_node
        
        # 1. AST-based Cyclomatic Complexity calculation
        complexity_score = 1.0
        
        if lang_name == "python":
            query_str = """
            (if_statement) @branch
            (for_statement) @branch
            (while_statement) @branch
            (try_statement) @branch
            (except_clause) @branch
            (with_statement) @branch
            (boolean_operator) @branch
            """
        else:
            # JavaScript, TypeScript, TSX, Go
            query_str = """
            (if_statement) @branch
            (for_statement) @branch
            (while_statement) @branch
            (try_statement) @branch
            (catch_clause) @branch
            (switch_case) @branch
            (binary_expression) @branch
            """
            
        try:
            captures = self._run_query(lang, query_str, root_node)
            branch_nodes = captures.get("branch", [])
            # Base complexity is 1, each branch adds 1
            complexity_score = 1.0 + len(branch_nodes)
        except Exception:
            pass
            
        # Cap complexity at 10.0 and scale it
        # 20 branches means a score of 10.0
        complexity_score = min(10.0, max(0.1, complexity_score / 2.0))
        
        # 2. AST-based Coupling calculation
        imports = self._extract_imports(root_node, lang_name, lang, code)
        exports = self._extract_exports(root_node, lang_name, lang, code)
        calls = self._extract_calls(root_node, lang_name, lang, code)
        
        # Base coupling is based on imports + exports, plus a fraction of calls (representing interaction density)
        raw_coupling = len(imports) * 2.0 + len(exports) * 1.5 + len(calls) * 0.1
        coupling_score = min(10.0, max(0.1, raw_coupling / 3.0))
        
        return {
            "complexity": round(complexity_score, 1),
            "coupling": round(coupling_score, 1)
        }
