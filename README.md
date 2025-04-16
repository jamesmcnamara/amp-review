# Amp Review Extension

This VS Code extension shows how to implement custom diagnostic messages that appear in the editor as well as the Problems panel.

## Features

- Shows "Information" diagnostics for lines containing "TODO"
- Shows "Warning" diagnostics for lines containing "console.log"
- Updates diagnostics in real-time as you type
- Provides a command to manually trigger diagnostics

## Usage

1. Open any file in VS Code
2. The extension will automatically flag TODOs and console.log statements
3. To run diagnostics manually, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and run "Run Amp Review"

## Customizing

To add your own diagnostic rules, modify the `updateDiagnostics` function in `src/extension.ts`.

## Building and Running

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Package the extension into a .vsix file
npx vsce package
```

To install the extension locally, use:

```bash
code --install-extension amp-review-0.1.0.vsix
```
