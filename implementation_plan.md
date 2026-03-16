# Implementation Plan

## Goal Description
Modify the existing VS Code extension template (`lsp-embedded-request-forwarding`) to provide Python auto-completion inside `<exec>...</exec>` tags in `xml` files, using the Jedi LSP server. Additionally, introduce an option to provide a real Python file (`source.py`) to be used as the context for the virtual document, so python classes defined in that file are available for completion.

## Proposed Changes

### Configuration
#### [MODIFY] package.json
- Change extension name to `xml-python-lsp`.
- Set the activation event to `onLanguage:xml`.
- Register the `xml` language configuration (remove `html1`).
- Add a configuration section: `xmlPython.sourceFile` (string) to specify the absolute or relative path to a Python file used as the base context for completions.
- Update `engines` and scripts if necessary.

### Client Side (Virtual Documents & Forwarding)
#### [MODIFY] client/src/extension.ts
- Change `html1` references to `xml`.
- Update the middleware to intercept completions for `xml` documents.
- Use `isInsideExecRegion` instead of [isInsideStyleRegion](file:///d:/webdev/vs_code_ext/try-again/lsp-embedded-request-forwarding/client/src/embeddedSupport.ts#31-51).
- When generating the virtual Python document, read the `xmlPython.sourceFile` (if specified) and place its contents at the top. Since we must preserve the line/character offset mapping for `vscode.executeCompletionItemProvider` without doing complex coordinate math, we can simply prepend the `source.py` code *into the whitespace area* of the virtual document, or, if `source.py` has `N` lines, shifting the request position by `N` lines when forwarding, and shifting the completion items back by `N` lines.
- Wait, the easiest approach that requires no coordinate shifting: The text *outside* `<exec>` tags is replaced with whitespaces/newlines. We can inject `from source import *` at line 0, column 0 of the virtual document (which is normally blank space due to `<xml>` root tags), assuming it fits. Or, better yet, we shift the position mathematically in the middleware.
- Let's do the mathematical shift: Virtual Doc = `[source.py content] + \n + [XML padded with whitespaces]`. 
  - `shiftText = sourcePyContent + '\n'`
  - `shiftLines = shiftText.split('\n').length - 1`
  - In `middleware.provideCompletionItem`:
    - Create virtual doc with shifted text.
    - Forward request with `position.translate(shiftLines)`.
    - Adjust returned [CompletionItem](file:///d:/webdev/vs_code_ext/try-again/lsp-embedded-request-forwarding/client/src/extension.ts#43-63) ranges by doing `range.translate(-shiftLines)`.

#### [MODIFY] client/src/embeddedSupport.ts
- Rewrite [isInsideStyleRegion](file:///d:/webdev/vs_code_ext/try-again/lsp-embedded-request-forwarding/client/src/embeddedSupport.ts#31-51) to `isInsideExecRegion`. We'll write a simple regex or use `vscode-html-languageservice` scanner to find `<exec>...</exec>` blocks.
- Since XML tags are parsed perfectly by the HTML scanner, we can look for `TokenType.StartTag` with text `exec`.
- Create `getPythonVirtualContent(documentText, sourcePyContent)`. It replaces everything outside `<exec>` regions with whitespace, and then prepends `sourcePyContent` to it.

### Server Side
#### [MODIFY] server/src/server.ts
- Change `htmlLanguageService` to something simple or remove it. The user said: "we just want to add support for python lsp in xml exec tags and nothing else for now". The server might not need to do any completions if not in `<exec>`. We can just return an empty list for outside `<exec>`.

## Verification Plan
### Automated & Manual Verification
- Compile the extension (`npm run compile`).
- Open a workspace with an `test.xml` file and `source.py` file.
- Configure `xmlPython.sourceFile` to point to `source.py`.
- In `source.py`, define `class TestFromSource: pass`.
- In `test.xml`, type `<exec>Test</exec>`.
- Trigger completion and verify `TestFromSource` appears.
