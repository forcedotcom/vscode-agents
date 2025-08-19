# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains UI/UX mockups for Agentforce DX, a Salesforce AI assistant development interface. Currently, the repository only contains design assets (mockup images) and no source code.

## Current Assets

- `preview.png` / `preview.svg` - Agent Preview interface mockup showing a conversational AI assistant
- `tracer.png` / `tracer.svg` - Agent Tracer interface mockup showing debugging/reasoning visualization

## Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling and development server
- **React Router** for navigation between mockup views
- **CSS-in-JS** approach with self-contained component styles

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Project Structure

```
src/
├── components/
│   ├── AgentPreview.tsx    # Chat interface mockup
│   ├── AgentPreview.css    # Styles for chat interface
│   ├── AgentTracer.tsx     # Debug/trace view mockup
│   └── AgentTracer.css     # Styles for trace view
├── assets/                 # Original mockup images
├── App.tsx                 # Main app with routing
├── App.css                 # App-level styles
├── main.tsx               # Entry point
└── index.css              # Global styles
```

## Component Architecture

- **AgentPreview**: Simulates the conversational AI interface with message history, input field, and debug mode toggle
- **AgentTracer**: Shows the reasoning and execution trace of AI agent operations, including topic selection, actions, and response validation

## Development Notes

- Components are self-contained with their own CSS files
- Dark mode is the default theme with light mode support via CSS media queries
- Mock data is currently hardcoded in components for demonstration purposes

## Claude Memory

- Whenever a task is finished, play a sound using `afplay /System/Library/Sounds/Funk.aiff`
- Do not run the server `npm run dev` to preview, I will do it myself
- Do not provide summaries after completing a task, as they are not needed
