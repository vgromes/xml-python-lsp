# Verification Walkthrough: XML Python LSP

## Development Changes Made

We have successfully adjusted the VS Code extension to provide autocomplete inside `<exec>` tags in `xml` files using the Python LSP server.

1. **Target Language Update**: We changed the extension's target from HTML to XML (`xml-python-lsp`).
2. **Virtual Python Documents**: We reconfigured the embedded language service ([embeddedSupport.ts](file:///d:/webdev/vs_code_ext/try-again/lsp-embedded-request-forwarding/client/src/embeddedSupport.ts)) to extract Python code specifically from `<exec>...</exec>` tags.
3. **Source File Injection**: A new VS Code configuration (`xmlPython.sourceFile`) has been introduced. When setting this configuration, the extension will read your target file (like `source.py`) and dynamically prepend its contents to the underlying virtual Document.
4. **Range Coordinate Mapping**: If `source.py` had 10 lines of code, the extension dynamically shifts all cursor requests by +10 lines when asking the Python LSP, and automatically subtracts 10 lines from all the CompletionItem responses before rendering them in your XML window.

## How to Verify Manually

To manually verify that everything works as expected, follow these steps:

### 1. Run the Extension
1. Go to the **Run and Debug** panel in VS Code (Ctrl+Shift+D).
2. Select **Client + Server** from the run configurations dropdown, and click the green play button.
3. A new Extension Development Host window will pop up.

### 2. Prepare the Workspace
1. In the new window, open a test directory.
2. Create a file named `source.py` with the following content:
```python
class TestClassFromSource:
    def hello_world(self):
        pass
```

### 3. Configure the Extensison
1. Open your workspace settings ([.vscode/settings.json](file:///d:/programiranje/webdev/vs_code_ext/try-again/on-git/.vscode/settings.json)).
2. Add the following configuration mapping:
```json
{
    "xmlPython.sourceFile": "source.py"
}
```

### 4. Test Autocompletion
1. Create a file named `sample.xml`.
2. Inside `sample.xml`, add the following content:
```xml
<root>
    <exec>Test</exec>
</root>
```
3. Place your cursor after `Test` inside the `<exec>` tags and press `Ctrl+Space` to trigger autocomplete.
4. The LSP should return `TestClassFromSource` as a valid autocompletion suggestion, injected directly from the `source.py` document.
