// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import path from "path";
import fs from "fs";
import { diffLines, Change } from "diff";
import * as os from "os";

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "geminiwebchat" is now active!');

  // The command has been defined in the package.json file
  // The commandId parameter must match the command field in package.json
  let geminiwebchat = vscode.commands.registerCommand(
    "webchatforgemini.open",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "webviewInteract",
        "Web Chat for Gemini",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "src")),
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        }
      );

      // CSS 파일 경로 설정
      const cssPathOnDisk = vscode.Uri.file(
        path.join(context.extensionPath, "src", "styles.css")
      );

      // vscode-resource -> webview-compatible URL로 변환
      const cssUri = panel.webview.asWebviewUri(cssPathOnDisk);

      // Load HTML content from file
      const htmlPath = path.join(context.extensionPath, "src/index.html");

      let html = fs.readFileSync(htmlPath, "utf8");

      const webview = panel.webview;
      const mediaPath = vscode.Uri.joinPath(context.extensionUri, "media");
      const componentsPath = path.join(
        context.extensionPath,
        "media",
        "components"
      );

      // components 폴더 내 모든 js 파일 읽기
      const componentFiles = fs
        .readdirSync(componentsPath)
        .filter((f) => f.endsWith(".js"));

      // components 내 파일들을 webview에 접근 가능한 URI로 변환 후 <script> 태그 문자열 생성
      const componentScripts = componentFiles
        .map((filename) => {
          const uri = webview.asWebviewUri(
            vscode.Uri.joinPath(mediaPath, "components", filename)
          );
          return `<script src="${uri}"></script>`;
        })
        .join("\n");

      // CSS URI를 삽입할 수 있도록 HTML에 placeholder 설정
      html = html.replace("{{styleUri}}", cssUri.toString());
      html = html.replace("{{componentScripts}}", componentScripts);

      panel.webview.html = html;

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === "insertOrUpdateCode") {
            //await insertOrUpdateClass(message.code);
            let func_data = JSON.parse(getFunc(message.code));

            for (let i = 0; i < func_data.length; i++) {
              console.log(func_data[i]);
            }
          } else if (message.command === "diffWithTempFile") {
            //await insertOrUpdateClass(message.code);

            const newCode = message.code as string;
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
              vscode.window.showErrorMessage("활성 편집기가 없습니다.");
              return;
            }

            const activeDocUri = editor.document.uri;
            const activeDocPath = activeDocUri.fsPath;

            // 1. 임시 파일 생성
            const tmpDir = os.tmpdir();
            const tmpFilePath = path.join(tmpDir, "gemini_temp_code.java");

            try {
              await fs.promises.writeFile(tmpFilePath, newCode, "utf8");

              // 2. 임시 파일 URI
              const tmpFileUri = vscode.Uri.file(tmpFilePath);

              // 3. vscode diff 실행
              const title = `Diff: 현재 편집기 ↔ Gemini 임시 코드`;

              await vscode.commands.executeCommand(
                "vscode.diff",
                activeDocUri,
                tmpFileUri,
                title,
                {
                  preview: true,
                  // 기타 옵션 설정 가능
                }
              );
            } catch (err) {
              vscode.window.showErrorMessage(
                `임시 파일 저장 또는 Diff 실행 중 오류 발생: ${err}`
              );
            }
          } else if (message.command === "sendToExtension") {
            console.log("Received from webview:", message.text);
            

            let prompt = message.text;

            // @파일이름 패턴 찾기
            const matches = prompt.match(/@([^\s]+)/g);
            if (matches) {
              for (const match of matches) {
                const filename = match.substring(1); // @ 제외
                const fileUri = await findFileInWorkspace(filename);

                if (fileUri) {
                  try {
                    const fileContent = await vscode.workspace.fs.readFile(
                      fileUri
                    );
                    const contentStr =
                      Buffer.from(fileContent).toString("utf-8");

                    // @파일이름 → 파일 내용으로 치환
                    prompt = prompt.replace(match, contentStr);
                  } catch (err) {
                    console.error(`파일 읽기 실패: ${filename}`, err);
                  }
                } else {
                  console.warn(`파일을 찾을 수 없음: ${filename}`);
                }
              }
            }
            console.log("Replaced Text:", prompt);
            var finalText = prompt;
            panel.webview.postMessage({
              command: "sendToGemini",
              text: finalText,
              files: [],
            });
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(geminiwebchat);

  // 워크스페이스에서 파일 찾기
  async function findFileInWorkspace(
    filename: string
  ): Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles(
      `**/${filename}`,
      "**/node_modules/**",
      1
    );
    return files.length > 0 ? files[0] : undefined;
  }

  function getFunc(markdown: string) {
    // 1) 코드 블록이 있으면 내부 코드만 사용
    const mdBlockRe = /```(?:java|text|)\\n([\\s\\S]*?)```/gi;
    const codeBlocks = [];
    let b;
    while ((b = mdBlockRe.exec(markdown)) !== null) {
      codeBlocks.push(b[1]);
    }
    const code = codeBlocks.length ? codeBlocks.join("\n") : markdown;

    // 2) 간단한 Java 메서드/생성자 검사 정규식
    // 메서드: (접근자) (옵션 static...) <반환형> <이름>(...) {
    const methodRe =
      /\b(?:public|protected|private)?\s*(?:static\s+|final\s+|abstract\s+|synchronized\s+|native\s+|strictfp\s+)*[\w<>\[\]]+\s+([a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*\{/g;

    // 생성자: 클래스명(...) {
    const classRe = /\bclass\s+([A-Za-z_$][\w$]*)/g;

    // 추출
    const methods = new Set();
    let m;
    while ((m = methodRe.exec(code)) !== null) {
      methods.add(m[1]);
    }

    // 클래스명 기반 생성자 검사 (이름이 클래스와 같으면 생성자)
    const classes = [];
    let c;
    while ((c = classRe.exec(code)) !== null) {
      classes.push(c[1]);
    }
    classes.forEach((cls) => {
      const ctorRe = new RegExp("\\b" + cls + "\\s*\\([^)]*\\)\\s*\\{", "g");
      if (ctorRe.test(code)) {
        methods.add(cls);
      }
    });

    // 결과를 콘솔에 출력 (배열)
    //console.log("추출된 함수명:", Array.from(methods));
    return JSON.stringify(Array.from(methods), null, 2);

    // (선택) 각 이름을 한 줄씩 출력
    //Array.from(methods).forEach(name => console.log("- " + name));
  }
}

// This method is called when the extension is deactivated. It's a No-Op at this point
export function deactivate() {}
