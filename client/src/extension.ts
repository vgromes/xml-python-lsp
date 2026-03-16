import * as path from 'path';
import * as fs from 'fs';
import { commands, CompletionList, CompletionItem, ExtensionContext, Uri, workspace } from 'vscode';
import { getLanguageService } from 'vscode-html-languageservice';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import { getPythonVirtualContent, isInsideExecRegion } from './embeddedSupport';

let client: LanguageClient;

const htmlLanguageService = getLanguageService();

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	const virtualDocumentContents = new Map<string, string>();

	workspace.registerTextDocumentContentProvider('embedded-content', {
		provideTextDocumentContent: uri => {
			const originalUri = uri.path.slice(1).slice(0, -3);
			const decodedUri = decodeURIComponent(originalUri);
			return virtualDocumentContents.get(decodedUri);
		}
	});

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'xml' }],
		middleware: {
			provideCompletionItem: async (document, position, context, token, next) => {
				if (!isInsideExecRegion(htmlLanguageService, document.getText(), document.offsetAt(position))) {
					// Outside of <exec>, fallback to standard LSP completion
					return await next(document, position, context, token);
				}

				const originalUri = document.uri.toString(true);

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

				virtualDocumentContents.set(
					originalUri,
					getPythonVirtualContent(htmlLanguageService, document.getText(), sourcePythonText)
				);

				const vdocUriString = `embedded-content://python/${encodeURIComponent(
					originalUri
				)}.py`;
				const vdocUri = Uri.parse(vdocUriString);

				const shiftedPosition = position.translate(shiftLines, 0);

				const completions = await commands.executeCommand<CompletionList | CompletionItem[]>(
					'vscode.executeCompletionItemProvider',
					vdocUri,
					shiftedPosition,
					context.triggerCharacter
				);

				if (!completions) {
					return;
				}

				const items = Array.isArray(completions) ? completions : completions.items;

				for (const item of items) {
					if (item.range) {
						if ('start' in item.range) {
							item.range = {
								start: item.range.start.translate(-shiftLines, 0),
								end: item.range.end.translate(-shiftLines, 0)
							} as any;
						} else if ('inserting' in item.range && 'replacing' in item.range) {
							item.range = {
								inserting: {
									start: item.range.inserting.start.translate(-shiftLines, 0),
									end: item.range.inserting.end.translate(-shiftLines, 0)
								},
								replacing: {
									start: item.range.replacing.start.translate(-shiftLines, 0),
									end: item.range.replacing.end.translate(-shiftLines, 0)
								}
							} as any;
						}
					}

					if (item.textEdit && item.textEdit.range && 'start' in item.textEdit.range) {
						item.textEdit.range = {
							start: item.textEdit.range.start.translate(-shiftLines, 0),
							end: item.textEdit.range.end.translate(-shiftLines, 0)
						} as any;
					}

					if (item.additionalTextEdits) {
						item.additionalTextEdits = item.additionalTextEdits.filter(edit => edit.range.start.line >= shiftLines);
						for (const edit of item.additionalTextEdits) {
							edit.range = {
								start: edit.range.start.translate(-shiftLines, 0),
								end: edit.range.end.translate(-shiftLines, 0)
							} as any;
						}
					}
				}

				return completions;
			}
		}
	};

	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
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
