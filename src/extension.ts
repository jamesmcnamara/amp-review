import * as vscode from 'vscode';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  console.log('Amp Review extension is now active');

  // Create a diagnostic collection for our extension
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection('amp-review');
  context.subscriptions.push(diagnosticCollection);

  // Register a command to trigger diagnostics manually
  const commandHandler = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      updateDiagnostics(editor.document);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('amp-review.runDiagnostics', commandHandler)
  );

  // Watch for document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      updateDiagnostics(event.document);
    })
  );

  // Watch for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDiagnostics(editor.document);
      }
    })
  );

  // Initial run for the active editor
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }
}

function updateDiagnostics(document: vscode.TextDocument): void {
  // Clear previous diagnostics for this document
  diagnosticCollection.delete(document.uri);

  const diagnostics: vscode.Diagnostic[] = [];

  // Example: Flag lines that contain the word "TODO"
  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
    const lineOfText = document.lineAt(lineIndex);

    // Look for TODOs
    if (lineOfText.text.includes('TODO')) {
      const todoIndex = lineOfText.text.indexOf('TODO');
      const range = new vscode.Range(
        lineIndex,
        todoIndex,
        lineIndex,
        todoIndex + 4
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        'This is a TODO item that needs to be addressed',
        vscode.DiagnosticSeverity.Information
      );

      diagnostic.code = 'custom-todo';
      diagnostic.source = 'Amp Review';

      diagnostics.push(diagnostic);
    }

    // Look for potential errors (as an example, flagging console.log statements)
    if (lineOfText.text.includes('console.log')) {
      const consoleIndex = lineOfText.text.indexOf('console.log');
      const range = new vscode.Range(
        lineIndex,
        consoleIndex,
        lineIndex,
        consoleIndex + 11
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        'Avoid using console.log in production code',
        vscode.DiagnosticSeverity.Warning
      );

      diagnostic.code = 'no-console';
      diagnostic.source = 'Amp Review';

      diagnostics.push(diagnostic);
    }
  }

  // Set the diagnostics for the current document
  diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}
