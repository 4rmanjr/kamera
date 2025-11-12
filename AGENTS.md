# Agent Guidelines for Camera Repository

This document outlines the conventions and commands for agents operating within this repository.

## 1. Build/Lint/Test Commands

*   **Build**: This project is a static web application. The "build" process involves serving the static files (HTML, CSS, JS). There are no formal build scripts.
*   **Lint**: No formal linting setup (e.g., ESLint) was found. Adhere to the code style guidelines below. Manual code review is expected for linting.
*   **Test**: No formal testing framework was found. For running a single test, isolate the function/module and execute it in a browser's developer console or a minimal HTML test harness.

## 2. Code Style Guidelines

*   **Modularity**: Use ES6 modules (`import`/`export`) for code organization.
*   **Formatting**: Use 4 spaces for indentation.
*   **Naming Conventions**:
    *   Variables and functions: `camelCase`
    *   Classes: `PascalCase`
*   **Error Handling**: Use `try...catch` blocks for asynchronous operations and potential runtime errors.
*   **Comments**: Use JSDoc-style comments for file headers and complex functions. Inline comments should explain *why* something is done, not *what*.
*   **Asynchronous Code**: Prefer `async/await` for handling asynchronous operations.
*   **Dependency Injection**: Follow the existing dependency injection pattern using the `DIContainer`.

## 3. Cursor/Copilot Rules

No specific `.cursor/rules/` or `.github/copilot-instructions.md` files were found in this repository.
