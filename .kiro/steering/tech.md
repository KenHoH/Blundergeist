---
title: Tech Stack and Integration Choices
inclusion: always
---

## Agent Execution Rules
- Never run parallel tool calls. Run at most 1 tool call per turn.
- During brainstorming or Q&A, do not read or search files unless explicitly asked. Just ask your question in text.

# Tech Stack and Integration Choices

## Frontend Framework

**Next.js** - The web application framework

## Core Dependencies

### GitHub Integration
- **GitHub REST API** for fetching PR data:
  - Commits and diffs
  - CI/CD status checks
  - Review comments
  - PR metadata and timeline events
- Rate limit: 5,000 requests/hour (authenticated)
- Use conditional requests (ETags) to save quota
- Cache PR data after first fetch

### LLM Provider
**Choice needed**: Select one of:
- OpenAI (GPT-4)
- Anthropic (Claude)
- Other provider with structured output support

**LLM Usage**:
- Score commits using a rubric with cited evidence
- Generate "Best Move" explanations for bad commits
- Input: commit diff, CI status, hindsight data, review comments
- Output: structured score, label, reason, suggestion

### Chess Board Visualization
- **chess.js** - Chess logic and move validation
- **react-chessboard** or **chessboard.jsx** - Board rendering component
- Pre-made game library stored as PGN files

### UI Components
- Tailwind CSS for styling
- Eval bar component (vertical slider)
- Move list with scrubbing
- Animated board transitions
- Best Move cards

## Data Flow

1. User pastes GitHub PR URL
2. Fetch PR data via GitHub API
3. Process each commit through LLM scoring
4. Generate eval bar and labels (truth layer)
5. Match to chess game from library
6. Map labels to move types (show layer)
7. Render board, eval bar, and explanations

## Lazy Choices

- No database: keep everything client-side or in memory
- No auth initially: public PRs only
- No backend initially: use Next.js API routes only if GitHub API requires server-side calls
- Use existing chess libraries, never build move generation from scratch
- One LLM provider, no fallback needed yet
