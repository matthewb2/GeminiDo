const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "gemini-web-vscode" is now active!');

    let disposable = vscode.commands.registerCommand('gemini-web-vscode.startChat', function () {
        const panel = vscode.window.createWebviewPanel(
            'geminiChat', // Identifies the type of the webview. Used internally
            'Gemini Chat', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                // Enable scripts in the webview
                enableScripts: true,
                // Restrict the webview to only loading content from our extension's `src` directory.
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src')]
            }
        );

        // Set the webview's initial content
        panel.webview.html = getWebviewContent(context, panel.webview);
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(context, webview) {
    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'index.html');
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    const
