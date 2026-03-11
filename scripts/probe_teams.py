#!/usr/bin/env python3
import os, subprocess, re

db_path = os.path.expanduser("~/Library/Containers/com.microsoft.teams2/Data/Library/Application Support/Microsoft/MSTeams/EBWebView/WV2Profile_tfl/IndexedDB/https_teams.live.com_0.indexeddb.leveldb")

log_file = os.path.join(db_path, "001473.log")
size = os.path.getsize(log_file)
result = subprocess.run(["strings", "-n", "30", log_file], capture_output=True, text=True, timeout=30)
lines = result.stdout.split("\n")
names = set()
for line in lines:
    if "displayName" in line:
        for m in re.finditer(r"displayName[^a-zA-Z]*([A-Z][a-zA-Z ]+)", line):
            name = m.group(1).strip()
            if 2 < len(name) < 40:
                names.add(name)
with open("/tmp/teams_probe.txt", "w") as f:
    f.write("SIZE: " + str(size) + "\n")
    f.write("LINES: " + str(len(lines)) + "\n")
    f.write("NAMES: " + str(len(names)) + "\n")
    for n in sorted(names):
        f.write("  - " + n + "\n")
