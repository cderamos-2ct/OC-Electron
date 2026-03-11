#!/usr/bin/env python3
"""Safe filesystem helper for OpenClaw operator tasks.

Usage:
  filesystem_helper.py inventory [path] [--depth N]
  filesystem_helper.py large-files [path] [--limit N] [--min-mb N]
  filesystem_helper.py duplicates [path] [--limit N] [--min-size-mb N]
  filesystem_helper.py empty-dirs [path] [--apply]
  filesystem_helper.py organize [path] [--apply]
  filesystem_helper.py cleanup-report [path ...] [--limit N] [--min-mb N]
  filesystem_helper.py trash <path> [<path> ...]
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


DEFAULT_SKIP_DIRS = {
    ".git",
    "node_modules",
    ".Trash",
    ".DS_Store",
    ".Spotlight-V100",
    ".fseventsd",
    "__pycache__",
}

CATEGORY_MAP = {
    ".jpg": "Images",
    ".jpeg": "Images",
    ".png": "Images",
    ".gif": "Images",
    ".webp": "Images",
    ".heic": "Images",
    ".svg": "Images",
    ".mp4": "Video",
    ".mov": "Video",
    ".mkv": "Video",
    ".avi": "Video",
    ".mp3": "Audio",
    ".wav": "Audio",
    ".m4a": "Audio",
    ".pdf": "Documents",
    ".doc": "Documents",
    ".docx": "Documents",
    ".txt": "Documents",
    ".rtf": "Documents",
    ".pages": "Documents",
    ".xls": "Spreadsheets",
    ".xlsx": "Spreadsheets",
    ".csv": "Spreadsheets",
    ".numbers": "Spreadsheets",
    ".ppt": "Presentations",
    ".pptx": "Presentations",
    ".key": "Presentations",
    ".zip": "Archives",
    ".tar": "Archives",
    ".gz": "Archives",
    ".tgz": "Archives",
    ".7z": "Archives",
    ".rar": "Archives",
    ".pkg": "Installers",
    ".dmg": "Installers",
    ".app": "Apps",
}


@dataclass
class FileEntry:
    path: Path
    size: int


def human_size(num_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)}{unit}"
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{num_bytes}B"


def should_skip_dir(dirname: str) -> bool:
    return dirname in DEFAULT_SKIP_DIRS


def walk_files(root: Path):
    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for filename in filenames:
            path = Path(current_root) / filename
            try:
                if path.is_symlink() or not path.is_file():
                    continue
                yield FileEntry(path=path, size=path.stat().st_size)
            except OSError:
                continue


def cmd_inventory(path: Path, depth: int) -> int:
    path = path.expanduser().resolve()
    if not path.exists():
        print(f"Path not found: {path}", file=sys.stderr)
        return 1

    total_files = 0
    total_dirs = 0
    total_bytes = 0
    extensions = Counter()

    for current_root, dirnames, filenames in os.walk(path):
        rel_parts = Path(current_root).relative_to(path).parts
        if len(rel_parts) >= depth:
            dirnames[:] = []
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        total_dirs += len(dirnames)
        for filename in filenames:
            entry = Path(current_root) / filename
            try:
                if entry.is_symlink() or not entry.is_file():
                    continue
                stat = entry.stat()
            except OSError:
                continue
            total_files += 1
            total_bytes += stat.st_size
            ext = entry.suffix.lower() or "(no extension)"
            extensions[ext] += 1

    print(f"Path: {path}")
    print(f"Files: {total_files}")
    print(f"Directories: {total_dirs}")
    print(f"Total size: {human_size(total_bytes)}")
    print("Top file types:")
    for ext, count in extensions.most_common(12):
        print(f"  {ext}: {count}")
    return 0


def cmd_large_files(path: Path, limit: int, min_mb: int) -> int:
    path = path.expanduser().resolve()
    min_bytes = min_mb * 1024 * 1024
    files = [entry for entry in walk_files(path) if entry.size >= min_bytes]
    files.sort(key=lambda entry: entry.size, reverse=True)

    if not files:
        print(f"No files larger than {min_mb}MB found in {path}.")
        return 0

    print(f"Largest files in {path} (min {min_mb}MB):")
    for entry in files[:limit]:
        print(f"  {human_size(entry.size):>8}  {entry.path}")
    return 0


def file_hash(path: Path) -> str | None:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as fh:
            while True:
                chunk = fh.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError:
        return None
    return digest.hexdigest()


def cmd_duplicates(path: Path, limit: int, min_size_mb: int) -> int:
    path = path.expanduser().resolve()
    min_bytes = min_size_mb * 1024 * 1024
    by_size: dict[int, list[Path]] = defaultdict(list)
    for entry in walk_files(path):
        if entry.size >= min_bytes:
            by_size[entry.size].append(entry.path)

    groups = []
    for size, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash: dict[str, list[Path]] = defaultdict(list)
        for candidate in paths:
            digest = file_hash(candidate)
            if digest:
                by_hash[digest].append(candidate)
        for digest, dup_paths in by_hash.items():
            if len(dup_paths) > 1:
                groups.append((size, digest, dup_paths))

    groups.sort(key=lambda item: (item[0] * len(item[2])), reverse=True)

    if not groups:
        print(f"No duplicate files found in {path} (min {min_size_mb}MB).")
        return 0

    print(f"Duplicate file groups in {path}:")
    for size, _, dup_paths in groups[:limit]:
        total_waste = size * (len(dup_paths) - 1)
        print(f"  Group: {len(dup_paths)} files, each {human_size(size)}, reclaimable {human_size(total_waste)}")
        for dup_path in dup_paths:
            print(f"    {dup_path}")
    return 0


def cmd_empty_dirs(path: Path, apply: bool) -> int:
    path = path.expanduser().resolve()
    empty_dirs = []
    for current_root, dirnames, filenames in os.walk(path, topdown=False):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        current = Path(current_root)
        if current == path:
            continue
        try:
            children = [child for child in current.iterdir() if child.name not in DEFAULT_SKIP_DIRS]
        except OSError:
            continue
        if not children and not filenames:
            empty_dirs.append(current)

    if not empty_dirs:
        print(f"No empty directories found in {path}.")
        return 0

    print(f"Empty directories in {path}:")
    for empty_dir in empty_dirs:
        print(f"  {empty_dir}")

    if apply:
        removed = 0
        for empty_dir in empty_dirs:
            try:
                empty_dir.rmdir()
                removed += 1
            except OSError:
                continue
        print(f"Removed {removed} empty directories.")
    else:
        print("Dry run only. Re-run with --apply to remove them.")
    return 0


def classify_file(path: Path) -> str:
    return CATEGORY_MAP.get(path.suffix.lower(), "Other")


def cmd_organize(path: Path, apply: bool) -> int:
    path = path.expanduser().resolve()
    if not path.is_dir():
        print(f"Directory not found: {path}", file=sys.stderr)
        return 1

    moves = []
    for child in path.iterdir():
        if child.name.startswith("."):
            continue
        if child.is_symlink():
            continue
        category = classify_file(child)
        if category == "Other":
            continue
        destination = path / category / child.name
        if destination == child:
            continue
        suffix = 1
        while destination.exists():
            destination = path / category / f"{child.stem}-{suffix}{child.suffix}"
            suffix += 1
        moves.append((child, destination))

    if not moves:
        print(f"No files to organize in {path}.")
        return 0

    print(f"Proposed organization for {path}:")
    for source, destination in moves:
        print(f"  {source.name} -> {destination.relative_to(path)}")

    if not apply:
        print("Dry run only. Re-run with --apply to perform the moves.")
        return 0

    for source, destination in moves:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(destination))
    print(f"Moved {len(moves)} items.")
    return 0


def cmd_cleanup_report(paths: list[Path], limit: int, min_mb: int) -> int:
    resolved_paths = [path.expanduser().resolve() for path in paths]
    print("Cleanup report")
    for target in resolved_paths:
        print(f"\n## {target}")
        if not target.exists():
            print("  Missing")
            continue
        total_files = 0
        total_bytes = 0
        extensions = Counter()
        large_files = []
        for entry in walk_files(target):
            total_files += 1
            total_bytes += entry.size
            extensions[entry.path.suffix.lower() or "(no extension)"] += 1
            if entry.size >= min_mb * 1024 * 1024:
                large_files.append(entry)
        print(f"  Files: {total_files}")
        print(f"  Total size: {human_size(total_bytes)}")
        print("  Top types:")
        for ext, count in extensions.most_common(8):
            print(f"    {ext}: {count}")
        large_files.sort(key=lambda item: item.size, reverse=True)
        if large_files:
            print(f"  Large files (>{min_mb}MB):")
            for entry in large_files[:limit]:
                print(f"    {human_size(entry.size):>8}  {entry.path}")
    return 0


def cmd_trash(paths: list[Path]) -> int:
    trash_bin = shutil.which("trash") or "/usr/bin/trash"
    if not Path(trash_bin).exists():
        print("trash command not available on this Mac.", file=sys.stderr)
        return 1

    missing = [str(path) for path in paths if not path.expanduser().exists()]
    if missing:
        print("Missing paths:", file=sys.stderr)
        for missing_path in missing:
            print(f"  {missing_path}", file=sys.stderr)
        return 1

    command = [trash_bin, *[str(path.expanduser()) for path in paths]]
    subprocess.run(command, check=True)
    print("Moved to Trash:")
    for path in paths:
        print(f"  {path.expanduser()}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safe filesystem helper for OpenClaw.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory = subparsers.add_parser("inventory")
    inventory.add_argument("path", nargs="?", default=str(Path.home()))
    inventory.add_argument("--depth", type=int, default=2)

    large = subparsers.add_parser("large-files")
    large.add_argument("path", nargs="?", default=str(Path.home() / "Downloads"))
    large.add_argument("--limit", type=int, default=20)
    large.add_argument("--min-mb", type=int, default=100)

    duplicates = subparsers.add_parser("duplicates")
    duplicates.add_argument("path", nargs="?", default=str(Path.home() / "Downloads"))
    duplicates.add_argument("--limit", type=int, default=10)
    duplicates.add_argument("--min-size-mb", type=int, default=25)

    empty_dirs = subparsers.add_parser("empty-dirs")
    empty_dirs.add_argument("path", nargs="?", default=str(Path.home() / "Downloads"))
    empty_dirs.add_argument("--apply", action="store_true")

    organize = subparsers.add_parser("organize")
    organize.add_argument("path", nargs="?", default=str(Path.home() / "Downloads"))
    organize.add_argument("--apply", action="store_true")

    cleanup = subparsers.add_parser("cleanup-report")
    cleanup.add_argument(
        "paths",
        nargs="*",
        default=[
            str(Path.home() / "Downloads"),
            str(Path.home() / "Desktop"),
            str(Path.home() / "Documents"),
        ],
    )
    cleanup.add_argument("--limit", type=int, default=10)
    cleanup.add_argument("--min-mb", type=int, default=100)

    trash = subparsers.add_parser("trash")
    trash.add_argument("paths", nargs="+")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "inventory":
        return cmd_inventory(Path(args.path), args.depth)
    if args.command == "large-files":
        return cmd_large_files(Path(args.path), args.limit, args.min_mb)
    if args.command == "duplicates":
        return cmd_duplicates(Path(args.path), args.limit, args.min_size_mb)
    if args.command == "empty-dirs":
        return cmd_empty_dirs(Path(args.path), args.apply)
    if args.command == "organize":
        return cmd_organize(Path(args.path), args.apply)
    if args.command == "cleanup-report":
        return cmd_cleanup_report([Path(p) for p in args.paths], args.limit, args.min_mb)
    if args.command == "trash":
        return cmd_trash([Path(p) for p in args.paths])

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
