#!/usr/bin/env python3
"""
Apple Notes helper using JXA (JavaScript for Automation).
Usage:
  apple_notes.py list [folder]
  apple_notes.py get "<note_name>"
  apple_notes.py create "<title>" "<body>" [folder]
  apple_notes.py update "<note_name>" "<new_body>"
  apple_notes.py delete "<note_name>"
  apple_notes.py folders
"""
import sys, json, subprocess

def run_jxa(js: str) -> str:
    r = subprocess.run(
        ["osascript", "-l", "JavaScript", "-e", js],
        capture_output=True, text=True, timeout=20
    )
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip())
    return r.stdout.strip()

def jq(s: str) -> str:
    """JSON-escape a string for embedding inside a JS string literal."""
    return json.dumps(s)  # returns "value" with quotes

def list_notes(folder=None):
    folder_filter = f'&& n.container().name() === {jq(folder)}' if folder else ''
    js = f"""
var app = Application('Notes');
var notes = app.notes();
var result = [];
for (var i = 0; i < notes.length; i++) {{
    try {{
        var n = notes[i];
        var folderName = n.container().name();
        if (true {folder_filter}) {{
            var b = (n.body() || '');
            var plain = b.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
            result.push({{
                id: n.id(),
                name: n.name() || '',
                folder: folderName,
                modified: n.modificationDate().toISOString(),
                preview: plain.substring(0, 200)
            }});
        }}
    }} catch(e) {{}}
}}
JSON.stringify(result);
"""
    out = run_jxa(js)
    return {"notes": json.loads(out) if out else []}

def get_note(name: str):
    js = f"""
var app = Application('Notes');
var notes = app.notes();
for (var i = 0; i < notes.length; i++) {{
    try {{
        var n = notes[i];
        if (n.name() === {jq(name)}) {{
            var b = n.body() || '';
            var plain = b.replace(/<[^>]+>/g, '\\n').replace(/\\n\\n+/g, '\\n\\n').trim();
            JSON.stringify({{
                id: n.id(),
                name: n.name(),
                folder: n.container().name(),
                body: b,
                plain: plain,
                modified: n.modificationDate().toISOString()
            }});
        }}
    }} catch(e) {{}}
}}
JSON.stringify({{error: 'Note not found: ' + {jq(name)}}});
"""
    out = run_jxa(js)
    return json.loads(out) if out else {"error": "No output"}

def create_note(title: str, body: str, folder: str = "Notes"):
    js = f"""
var app = Application('Notes');
var props = {{ name: {jq(title)}, body: {jq(body)} }};
var targetFolder = null;
var folders = app.folders();
for (var i = 0; i < folders.length; i++) {{
    if (folders[i].name() === {jq(folder)}) {{ targetFolder = folders[i]; break; }}
}}
var newNote;
if (targetFolder) {{
    newNote = app.make({{new: 'note', at: targetFolder, withProperties: props}});
}} else {{
    newNote = app.make({{new: 'note', withProperties: props}});
}}
JSON.stringify({{ok: true, id: newNote.id(), name: {jq(title)}}});
"""
    out = run_jxa(js)
    return json.loads(out) if out else {"ok": True}

def update_note(name: str, new_body: str):
    js = f"""
var app = Application('Notes');
var notes = app.notes();
for (var i = 0; i < notes.length; i++) {{
    try {{
        var n = notes[i];
        if (n.name() === {jq(name)}) {{
            n.body = {jq(new_body)};
            JSON.stringify({{ok: true, name: {jq(name)}}});
        }}
    }} catch(e) {{}}
}}
JSON.stringify({{error: 'Note not found'}});
"""
    out = run_jxa(js)
    return json.loads(out) if out else {"error": "No output"}

def delete_note(name: str):
    js = f"""
var app = Application('Notes');
var notes = app.notes();
for (var i = 0; i < notes.length; i++) {{
    try {{
        var n = notes[i];
        if (n.name() === {jq(name)}) {{
            app.delete(n);
            JSON.stringify({{ok: true}});
        }}
    }} catch(e) {{}}
}}
JSON.stringify({{error: 'Note not found'}});
"""
    out = run_jxa(js)
    return json.loads(out) if out else {"error": "No output"}

def list_folders():
    js = """
var app = Application('Notes');
var folders = app.folders();
var names = [];
for (var i = 0; i < folders.length; i++) {
    try { names.push(folders[i].name()); } catch(e) {}
}
JSON.stringify(names);
"""
    out = run_jxa(js)
    return {"folders": json.loads(out) if out else []}

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(json.dumps({"error": "No command given"}))
        sys.exit(1)
    cmd = args[0]
    try:
        if cmd == "list":
            folder = args[1] if len(args) > 1 else None
            print(json.dumps(list_notes(folder)))
        elif cmd == "get":
            print(json.dumps(get_note(args[1])))
        elif cmd == "create":
            title  = args[1] if len(args) > 1 else ""
            body   = args[2] if len(args) > 2 else ""
            folder = args[3] if len(args) > 3 else "Notes"
            print(json.dumps(create_note(title, body, folder)))
        elif cmd == "update":
            print(json.dumps(update_note(args[1], args[2])))
        elif cmd == "delete":
            print(json.dumps(delete_note(args[1])))
        elif cmd == "folders":
            print(json.dumps(list_folders()))
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
