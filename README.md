# xml-python-lsp

A VS Code extension that provides Python autocompletion inside `<exec>...</exec>` tags in XML files, using embedded language request forwarding to the Python LSP.

## How It Works

When your cursor is inside an `<exec>` block in an XML file, the extension:

1. Extracts the Python code from all `<exec>` regions, replacing everything else with whitespace to preserve line/character offsets.
2. Optionally prepends the contents of a configured Python source file (`source.py`) to act as a shared completion context.
3. Forwards the completion request to the active Python LSP (e.g., Pylance / Jedi) against a virtual `.py` document.
4. Translates the returned completion item ranges back to the original XML coordinates before rendering them.

Outside of `<exec>` tags, the extension falls back to standard XML LSP behavior.

## Setup

### 1. Install dependencies

```bash
npm install
```

This installs dependencies for the root, client, and server packages.

### 2. Compile

```bash
npm run compile
```

Or use `Ctrl+Shift+B` in VS Code to watch-compile.

### 3. Launch the extension

Open the **Run and Debug** panel (`Ctrl+Shift+D`), select **Client + Server**, and press the green play button. A new Extension Development Host window will open.

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `xmlPython.sourceFile` | `string` | `""` | Path (absolute or workspace-relative) to a Python file whose contents are prepended to the virtual document, making its classes and functions available for completion inside `<exec>` tags. |
| `xmlPython.ignoreDiagnostics` | `string[]` | `[]` | List of diagnostic codes or message strings to suppress (e.g. `"reportUndefinedVariable"`). |

### Example workspace settings

```json
{
    "xmlPython.sourceFile": "source.py"
}
```

## Usage

1. Open (or create) an XML file in the Extension Development Host.
2. Add `<exec>` tags and start typing Python inside them:

```xml
<root>
    <exec>TestClass</exec>
</root>
```

3. Press `Ctrl+Space` to trigger autocomplete. If `xmlPython.sourceFile` points to a file that defines `TestClass`, it will appear as a suggestion.

### Source file context example

`source.py`:
```python
class TestClassFromSource:
    def hello_world(self):
        pass
```

With `xmlPython.sourceFile` set to `source.py`, typing `Test` inside any `<exec>` tag and pressing `Ctrl+Space` will suggest `TestClassFromSource`.

## Debugging

To also debug the server process, use the **Attach to Server** launch configuration after the client is running.
