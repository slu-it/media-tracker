#!/usr/bin/env python3
"""Deterministic test totals for the test-runner (.claude/agents/test-runner.md).

Usage (from the repo root):
    python3 .claude/scripts/test-summary.py [--since <unix-seconds>]

Sums the JUnit XML reports instead of reading console output, which is truncated and prints no backend totals:
    backend   backend/build/test-results/test/TEST-*.xml  (Gradle, one file per test class)
    frontend  frontend/build/test-results/vitest-junit.xml (Vitest junit reporter, vite.config.ts)

With --since (take it with `date +%s` right before the test command), only reports written at or after that
moment count. A project whose reports are all older is STALE: its test task was up to date or from cache, so no
tests ran. Older backend files next to fresh ones (e.g. from an earlier unfiltered run) are ignored and counted
in `ignored-stale`.

Read-only; prints one line per project and exits 1 on failures, errors, STALE or MISSING.
"""
import argparse
import glob
import os
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECTS = [
    ("backend", "backend/build/test-results/test/TEST-*.xml"),
    ("frontend", "frontend/build/test-results/vitest-junit.xml"),
]
FIELDS = ("tests", "failures", "errors", "skipped")


def suites(path):
    root = ET.parse(path).getroot()
    # Gradle writes one <testsuite> root per file; Vitest wraps its suites (one per test file) in <testsuites>.
    return [root] if root.tag == "testsuite" else root.iter("testsuite")


def summarize(pattern, since):
    files = sorted(glob.glob(os.path.join(ROOT, pattern)))
    if not files:
        return "MISSING", None, 0, 0
    fresh = [f for f in files if since is None or os.path.getmtime(f) >= since]
    if not fresh:
        return "STALE", None, 0, len(files)
    totals = dict.fromkeys(FIELDS, 0)
    for path in fresh:
        for suite in suites(path):
            for field in FIELDS:
                totals[field] += int(suite.get(field, 0))
    status = "FAIL" if totals["failures"] or totals["errors"] else "PASS"
    return status, totals, len(fresh), len(files) - len(fresh)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", type=float, help="unix seconds taken right before the test command")
    args = parser.parse_args()

    ok = True
    for name, pattern in PROJECTS:
        status, totals, fresh, stale = summarize(pattern, args.since)
        ok &= status == "PASS"
        if totals is None:
            detail = "no report file" if status == "MISSING" else f"all {stale} report file(s) older than --since, no tests ran"
            print(f"{name}: {status} ({detail})")
        else:
            counts = ", ".join(f"{totals[f]} {f}" for f in FIELDS)
            extra = f", ignored-stale {stale}" if stale else ""
            print(f"{name}: {status} {counts} (report files {fresh}{extra})")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
