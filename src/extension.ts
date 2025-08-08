// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path from "path";
import fs from "fs";

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "geminiwebchat" is now active!');

	// The command has been defined in the package.json file
	// The commandId parameter must match the command field in package.json
	let geminiwebchat = vscode.commands.registerCommand('webchatforgemini.open', () => {
		const panel = vscode.window.createWebviewPanel(
			"webviewInteract",
			"Web Chat for Gemini",
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))],
			}
		);

		// CSS 파일 경로 설정
		const cssPathOnDisk = vscode.Uri.file(path.join(context.extensionPath, 'src', 'styles.css'));

		// vscode-resource -> webview-compatible URL로 변환
		const cssUri = panel.webview.asWebviewUri(cssPathOnDisk);

		// Load HTML content from file
		const htmlPath = path.join(context.extensionPath, "src/index.html");

		let html = fs.readFileSync(htmlPath, "utf8");

		// CSS URI를 삽입할 수 있도록 HTML에 placeholder 설정
		html = html.replace("{{styleUri}}", cssUri.toString());

		panel.webview.html = html;

		panel.webview.onDidReceiveMessage(
			async message => {
				if (message.command === 'sendToGemini') {
					console.log('Received from webview:', message.text);
				}
				panel.webview.postMessage({
					command: 'addSystemMessage',
					text: '이 메시지는 확장에서 보냈습니다.',
					is_error: false
				});


			},
			undefined,
			context.subscriptions
		);


	});

	context.subscriptions.push(geminiwebchat);
}

// This method is called when the extension is deactivated. It's a No-Op at this point
export function deactivate() { }
