# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Notes

- Components are self-contained with their own CSS files
- Dark mode is the default theme with light mode support via CSS media queries

## Claude Memory

- Whenever a task is finished, play a sound using `afplay /System/Library/Sounds/Funk.aiff`
- Do not run the server `npm run dev` to preview, I will do it myself
- Do not provide summaries after completing a task, as they are not needed
- Always run `npm run compile` from the working directory after completing a task to ensure TypeScript compilation is successful
- Everytime you make a significant change you should commit it using the same style of previous log messages