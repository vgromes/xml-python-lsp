import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { commands, CompletionList, CompletionItem, ExtensionContext, Position, Range, Uri, workspace } from 'vscode';
import { getLanguageService } from 'vscode-html-languageservice';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import { getPythonVirtualContent, isInsideExecRegion } from './embeddedSupport';

let client: LanguageClient;

const htmlLanguageService = getLanguageService();

export function activate(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'xml' }],
		middleware: {
			provideCompletionItem: async (document, position, context, token, next) => {
				if (!isInsideExecRegion(htmlLanguageService, document.getText(), document.offsetAt(position))) {
					return await next(document, position, context, token);
				}

				const config = workspace.getConfiguration('xmlPython', document.uri);
				let sourceFilePath = config.get<string>('sourceFile') || '';

				if (sourceFilePath && !path.isAbsolute(sourceFilePath)) {
					const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
					if (workspaceFolder) {
						sourceFilePath = path.join(workspaceFolder.uri.fsPath, sourceFilePath);
					}
				}

				let sourcePythonText = '';
				let shiftLines = 0;
				if (sourceFilePath && fs.existsSync(sourceFilePath)) {
					sourcePythonText = fs.readFileSync(sourceFilePath, 'utf8');
					shiftLines = sourcePythonText.split('\n').length;
				}

				const virtualContent = getPythonVirtualContent(htmlLanguageService, document.getText(), sourcePythonText);

				// Hash includes the content so any change to source.py produces a fresh temp file
				// that Pylance hasn't cached, avoiding stale completions.
				const hash = crypto.createHash('md5').update(virtualContent).digest('hex');
				const tempFilePath = path.join(os.tmpdir(), `xml-python-lsp-${hash}.py`);
				fs.writeFileSync(tempFilePath, virtualContent, 'utf8');
				const tempFileUri = Uri.file(tempFilePath);

				// Open the document so VS Code / Pylance registers it
				await workspace.openTextDocument(tempFileUri);

				const completions = await commands.executeCommand<CompletionList | CompletionItem[]>(
					'vscode.executeCompletionItemProvider',
					tempFileUri,
					position.translate(shiftLines, 0),
					context.triggerCharacter
				);

				if (!completions) {
					return;
				}

				const items = Array.isArray(completions) ? completions : completions.items;

				for (const item of items) {
					if (!item.range) { continue; }
					if ('inserting' in item.range && 'replacing' in item.range) {
						item.range = {
							inserting: new Range(
								new Position(item.range.inserting.start.line - shiftLines, item.range.inserting.start.character),
								new Position(item.range.inserting.end.line - shiftLines, item.range.inserting.end.character)
							),
							replacing: new Range(
								new Position(item.range.replacing.start.line - shiftLines, item.range.replacing.start.character),
								new Position(item.range.replacing.end.line - shiftLines, item.range.replacing.end.character)
							)
						};
					} else if ('start' in item.range) {
						item.range = new Range(
							new Position(item.range.start.line - shiftLines, item.range.start.character),
							new Position(item.range.end.line - shiftLines, item.range.end.character)
						);
					}
				}

				return items;
			}
		}
	};

	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example XmlPython',
		serverOptions,
		clientOptions
	);

	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
