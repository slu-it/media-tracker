#!/usr/bin/env python3
"""PreToolUse guard for the project's subagents (.claude/agents/*.md).

Usage (from a subagent's frontmatter hooks block):
    python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/agent-guard.py" <role>

Roles:
    readonly     test-runner, reviewer: verification only, the tree must not change.
    implementer  scoped edits: no commits/branch changes, no full builds, no edits to
                 applied migrations, docs, CLAUDE.md or the gitignored SPA copy.

Reads the hook JSON on stdin. Prints a JSON permission decision on stdout and exits 0;
a denied call tells the subagent why, so it can report instead of retrying.
"""
import json
import os
import re
import sys

GIT_MUTATIONS = r"\bgit\b(\s+-{1,2}\S*(\s+[^-\s]\S*)?)*\s+(commit|push|pull|fetch|checkout|switch|reset|restore|stash(?!\s+(list|show)\b)|merge|rebase|cherry-pick|revert|rm|mv|clean|tag|am|apply|config|branch\s+(-[dDmM]|--delete|--move))\b"
DEV_SCRIPTS = r"(start-dev\.sh|build-and-start-locally\.sh|:backend:run\b|\brunFatJar\b|\bgradlew\s+run\b)"

RULES = {
    "readonly": [
        (r"\bktlintFormat\b", "test-runner/reviewer are read-only: ktlintFormat rewrites files"),
        (r":?pnpmFormat($|[^A-Za-z])|\bpnpmLintFix\b", "read-only agent: Gradle pnpmFormat/pnpmLintFix rewrite files"),
        (r"\bpnpm\s+(run\s+)?format($|\s)|\bpnpm\s+(run\s+)?lint:fix\b", "read-only agent: pnpm format / lint:fix rewrite files (format:check and lint are fine)"),
        (r"\bpnpm\s+(install|i|add|remove|rm|update|up)\b", "read-only agent: dependency changes are not allowed"),
        (DEV_SCRIPTS, "read-only agent: dev servers and scripts must not be started"),
        (GIT_MUTATIONS, "read-only agent: git must not change state"),
        (r"\b(sed\s+-i|tee|rm|mv|cp|mkdir|touch|chmod|chown|truncate)\b", "read-only agent: shell file mutations are not allowed"),
        (r"(?<![0-9&<])>{1,2}(?!&)\s*(?!/dev/null)\S", "read-only agent: output redirection into files is not allowed"),
    ],
    "implementer": [
        (GIT_MUTATIONS, "implementer: no commits, branch, stash or history changes; report the diff instead"),
        (r"\bgradlew\b[^|;&]*(\s|:)(build|buildFatJar|check)(\s|$)", "implementer: full builds belong to the test-runner; run the narrow test and formatter only"),
        (r"\bpnpm\s+(run\s+)?build\b|\bpnpmBuild\b", "implementer: pnpm build belongs to the test-runner; use pnpm typecheck"),
        (r"-Pmt\.dev\b", "implementer: -Pmt.dev is for the dev loop only"),
        (DEV_SCRIPTS, "implementer: dev servers and scripts must not be started"),
    ],
}

PROTECTED_PATHS = {
    "implementer": [
        (r"(^|/)backend/src/main/resources/app(/|$)", "backend/src/main/resources/app/ must stay empty (built frontend is copied by Gradle)"),
        (r"(^|/)(README\.md|CLAUDE\.md)$|(^|/)docs/", "implementer does not edit docs; report doc/ADR impact in the summary"),
        (r"(^|/)frontend/pnpm-lock\.yaml$", "edit pnpm-lock.yaml only through pnpm install, not by hand"),
    ],
}

EXISTING_ONLY_PATHS = {
    "implementer": [
        (r"(^|/)db/migration/V\d+__.*\.sql$", "never edit an applied migration; add V<n+1>__*.sql instead"),
    ],
}


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main() -> None:
    role = sys.argv[1] if len(sys.argv) > 1 else "readonly"
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # malformed input: do not block
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}

    if tool == "Bash":
        command = tool_input.get("command", "")
        for pattern, reason in RULES.get(role, []):
            if re.search(pattern, command):
                deny(f"Blocked by agent-guard ({role}): {reason}. Command: {command[:200]}")
    elif tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        normalized = path.replace("\\", "/")
        for pattern, reason in PROTECTED_PATHS.get(role, []):
            if re.search(pattern, normalized):
                deny(f"Blocked by agent-guard ({role}): {reason}. Path: {path}")
        for pattern, reason in EXISTING_ONLY_PATHS.get(role, []):
            if re.search(pattern, normalized) and os.path.exists(path):
                deny(f"Blocked by agent-guard ({role}): {reason}. Path: {path}")
    sys.exit(0)


if __name__ == "__main__":
    main()
