// Shared interfaces between Backend API responses and Frontend views

export type NodeType = 
  | "repository"
  | "folder"
  | "file"
  | "class"
  | "function"
  | "api_endpoint"
  | "database_table"
  | "service";

export type EdgeType =
  | "IMPORTS"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "DEPENDS_ON"
  | "ROUTES_TO"
  | "READS"
  | "WRITES";

export interface CodeNode {
  id: string; // Unique path or qualified symbol name
  name: string; // Basename or symbol identifier
  type: NodeType;
  parent?: string; // Parent folder id or parent class/file id
  summary?: string; // LLM-generated semantic summary
  importance?: number; // Calculated importance score (0-10)
  tags?: string[]; // Semantic groupings (e.g. "auth", "db")
}

export interface CodeEdge {
  id: string; // "from-to-type"
  source: string; // Source node ID
  target: string; // Target node ID
  type: EdgeType;
}

export interface CodebaseGraph {
  repositoryId: string;
  nodes: CodeNode[];
  edges: CodeEdge[];
}

export interface RepositoryStatus {
  id: string;
  repoUrl: string;
  status: "queued" | "cloning" | "parsing" | "summarizing" | "completed" | "failed";
  progress: number; // 0.0 to 100.0
  errorMessage?: string;
}

export interface CodeTourStep {
  stepNumber: number;
  title: string;
  description: string;
  fileId: string;
  functionId?: string;
  lineRange?: [number, number];
}

export interface CodeTour {
  id: string;
  title: string;
  description: string;
  steps: CodeTourStep[];
}
