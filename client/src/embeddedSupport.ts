import { LanguageService, TokenType } from 'vscode-html-languageservice';

interface EmbeddedRegion {
	start: number;
	end: number;
}

export function getExecRegions(languageService: LanguageService, documentText: string): EmbeddedRegion[] {
	const regions: EmbeddedRegion[] = [];
	const scanner = languageService.createScanner(documentText);
	let token = scanner.scan();
	let execStart = -1;
	let pendingEndTagOpenOffset = -1;
	while (token !== TokenType.EOS) {
		if (token === TokenType.StartTag && scanner.getTokenText() === 'exec') {
			while (token !== TokenType.EOS && token !== TokenType.StartTagClose) {
				token = scanner.scan();
			}
			if (token === TokenType.StartTagClose) {
				execStart = scanner.getTokenEnd();
			}
		} else if (token === TokenType.EndTagOpen) {
			pendingEndTagOpenOffset = scanner.getTokenOffset();
		} else if (token === TokenType.EndTag && scanner.getTokenText() === 'exec') {
			if (execStart !== -1) {
				const endOffset = pendingEndTagOpenOffset !== -1 ? pendingEndTagOpenOffset : scanner.getTokenOffset();
				regions.push({ start: execStart, end: endOffset });
				execStart = -1;
			}
			pendingEndTagOpenOffset = -1; // reset it
		}
		token = scanner.scan();
	}
	// We do not want to push an unclosed region, since `<exec>` without `</exec>`
	// might just encompass the whole document, which is an error in XML. But if we do:
	if (execStart !== -1) {
		regions.push({ start: execStart, end: documentText.length });
	}
	return regions;
}

export function isInsideExecRegion(
	languageService: LanguageService,
	documentText: string,
	offset: number
) {
	const regions = getExecRegions(languageService, documentText);
	for (const r of regions) {
		if (offset >= r.start && offset <= r.end) return true;
	}
	return false;
}

export function getPythonVirtualContent(
	languageService: LanguageService,
	documentText: string,
	sourcePythonText: string
): string {
	const regions = getExecRegions(languageService, documentText);

	let content = documentText
		.split('\n')
		.map(line => ' '.repeat(line.length))
		.join('\n');

	regions.forEach(r => {
		content = content.slice(0, r.start) + documentText.slice(r.start, r.end) + content.slice(r.end);
	});

	if (sourcePythonText) {
		content = sourcePythonText + '\n' + content;
	}

	return content;
}
