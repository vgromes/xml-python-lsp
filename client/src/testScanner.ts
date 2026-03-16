import { getLanguageService, TokenType } from 'vscode-html-languageservice';

const ls = getLanguageService();
const scanner = ls.createScanner('<exec>\nTest\n</exec>');
let token = scanner.scan();
while (token !== TokenType.EOS) {
    console.log(`Token: ${token}, Text: ${scanner.getTokenText()}, Offset: ${scanner.getTokenOffset()}, End: ${scanner.getTokenEnd()}`);
    token = scanner.scan();
}
