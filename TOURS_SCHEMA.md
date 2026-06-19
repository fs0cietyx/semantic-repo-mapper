# Narrative Code Tours - JSON Schema Design (v1)

This schema defines how "Narrative Code Tours" are structured and played back in the visualizer.

## Schema Structure

```json
{
  "repo_id": "owner_repo",
  "tours": [
    {
      "id": "tour_unique_id",
      "title": "Tour Title",
      "description": "High-level description of what this tour covers.",
      "difficulty": "beginner | intermediate | advanced",
      "estimated_time": "5m",
      "steps": [
        {
          "id": "step_1",
          "title": "Step Title",
          "message": "Markdown-supported explanation of this step.",
          "target": {
            "node_id": "path/to/file.py",
            "type": "file | folder | class | function",
            "line_range": [10, 20] 
          },
          "actions": [
            {
              "type": "highlight | zoom | focus | open_file",
              "params": {}
            }
          ]
        }
      ]
    }
  ]
}
```

## Key Components

- **target**: Defines the focal point of the step. Can be a node in the graph or a specific line range in a file.
- **actions**: Optional sequence of UI actions to trigger (e.g., zooming the graph to the node, opening the file in the editor).
- **message**: The narrative content shown to the user.

## Implementation Plan

1. **Backend**: Update the `/api/repository/{repo_id}/tours` endpoint to serve tours following this schema.
2. **Frontend**: Create a `TourPlayer` component that:
   - Fetches tours for the current repository.
   - Allows users to select a tour from a list.
   - Displays a step-by-step navigation overlay.
   - Triggers graph and editor actions based on step targets.
