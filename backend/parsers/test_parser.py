import os
import sys
from ast_parser import ASTParser

def run_test():
    # Find current file path and resolve workspace locations
    current_dir = os.path.dirname(os.path.abspath(__file__))
    visualizer_root = os.path.dirname(os.path.dirname(current_dir))
    
    # Path to the AST parser class instance
    parser = ASTParser()
    
    # Target file to parse as a test: backend/api/main.py
    target_file = os.path.join(visualizer_root, "backend", "api", "main.py")
    
    if not os.path.exists(target_file):
        print(f"Target test file not found at: {target_file}")
        sys.exit(1)
        
    print(f"Parsing test file: {target_file}...")
    result = parser.parse_file(target_file)
    
    if not result:
        print("Failed to parse file or language not supported.")
        sys.exit(1)
        
    print("\n=== PARSE SUCCESSFUL ===")
    print(f"Imports count: {len(result['imports'])}")
    for imp in result['imports']:
        print(f"  [{imp['range']}] {imp['statement']}")
        
    print(f"\nClasses count: {len(result['classes'])}")
    for cls in result['classes']:
        print(f"  [{cls['range']}] {cls['name']} extends {cls['extends']}")
        
    print(f"\nFunctions count: {len(result['functions'])}")
    for func in result['functions']:
        print(f"  [{func['range']}] {func['name']}")
        
    print(f"\nCalls count: {len(result['calls'])}")
    for call in result['calls']:
        print(f"  [line {call['line']}] called: {call['target']}")

    print("\n=== PARSE FUNCTION FLOW TEST ===")
    print("Parsing control flow for function: import_repository...")
    flow = parser.parse_function_flow(target_file, "import_repository")
    print(f"Flow steps count: {len(flow)}")
    for idx, step in enumerate(flow):
        print(f"  [{idx + 1}] Line {step['line']}: called {step['target']}")

if __name__ == "__main__":
    run_test()
