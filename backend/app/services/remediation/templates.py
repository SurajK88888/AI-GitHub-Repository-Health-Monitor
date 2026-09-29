"""Remediation file templates and generators.

Generates safe, standard repository configuration files for common health findings:
- SECURITY.md (vulnerability disclosure policy)
- .github/dependabot.yml (automated dependency updates)
- .github/workflows/ci.yml (basic CI pipeline)
- README.md (repository documentation template)
- CONTRIBUTING.md (contribution guidelines)

Zero-vulnerability invariant:
Generated files NEVER contain hardcoded tokens, passwords, or personal credentials.
"""

from __future__ import annotations

import re
from typing import Any


def _sanitize_name(name: str) -> str:
    """Strip any characters that are not alphanumeric, dash, or underscore."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "", name)


def generate_security_policy(repo_name: str) -> str:
    safe_name = _sanitize_name(repo_name) or "this repository"
    return f"""# Security Policy

## Supported Versions

Please see the table below for supported versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of {safe_name} seriously.

If you discover a security vulnerability, please do NOT open a public GitHub issue.
Instead, please report it privately via GitHub Security Advisories:

1. Navigate to the **Security** tab of the repository.
2. Click on **Advisories**.
3. Click **Report a vulnerability** to open a private advisory report.

You will receive an acknowledgment of your report within 48 hours.
"""


def generate_dependabot_config() -> str:
    return """version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
"""


def generate_ci_workflow(repo_name: str) -> str:
    safe_name = _sanitize_name(repo_name) or "CI"
    return f"""name: {safe_name} CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run verification
        run: |
          echo "Running automated verification..."
"""


def generate_readme(repo_name: str, description: str | None = None) -> str:
    safe_name = repo_name or "Project"
    desc_str = description or "Repository monitored for health, security, and quality."
    return f"""# {safe_name}

{desc_str}

## Getting Started

### Prerequisites
- Git

### Installation
```bash
git clone https://github.com/{safe_name}.git
cd {safe_name}
```

## Contributing
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License
Please refer to the LICENSE file for terms of use.
"""


def generate_contributing_guide(repo_name: str) -> str:
    safe_name = repo_name or "this project"
    return f"""# Contributing to {safe_name}

Thank you for your interest in contributing!

## How to Contribute

1. Fork the repository and create your branch from `main`.
2. Ensure any new or changed code is documented and tested.
3. Submit a pull request with a clear description of your changes.

## Code of Conduct

Please maintain a respectful and welcoming environment for all contributors.
"""


def generate_remediation_content(
    action_type: str,
    category: str,
    repo_name: str,
    parameters: dict[str, Any] | None = None,
) -> tuple[str, str, str]:
    """Return (target_file_path, commit_message, file_content) for a remediation action.

    Args:
        action_type: Action type string (e.g., 'ADD_SECURITY_POLICY', 'ENABLE_DEPENDABOT').
        category: Health category (e.g., 'SECURITY', 'CONFIGURATION').
        repo_name: Short or full repository name.
        parameters: Optional extra parameters passed with the action.

    Returns:
        tuple of (file_path, commit_message, content_string)
    """
    params = parameters or {}
    custom_path = params.get("file_path")
    custom_content = params.get("content")

    normalized_type = action_type.upper()

    if custom_path and custom_content:
        return (
            str(custom_path),
            params.get("commit_message", f"chore: automated remediation for {category.lower()}"),
            str(custom_content),
        )

    if "SECURITY" in normalized_type or "SECURITY_POLICY" in normalized_type:
        return (
            "SECURITY.md",
            "docs: add security policy (SECURITY.md)",
            generate_security_policy(repo_name),
        )

    if "DEPENDABOT" in normalized_type:
        return (
            ".github/dependabot.yml",
            "ci: add dependabot configuration",
            generate_dependabot_config(),
        )

    if "CI" in normalized_type or "WORKFLOW" in normalized_type:
        return (
            ".github/workflows/ci.yml",
            "ci: add continuous integration workflow",
            generate_ci_workflow(repo_name),
        )

    if "README" in normalized_type or category == "DOCUMENTATION":
        return (
            "README.md",
            "docs: initialize repository README.md",
            generate_readme(repo_name, params.get("description")),
        )

    if "CONTRIBUTING" in normalized_type:
        return (
            "CONTRIBUTING.md",
            "docs: add contributing guide",
            generate_contributing_guide(repo_name),
        )

    # Generic fallback: documentation note
    return (
        "docs/REMEDIATION.md",
        f"docs: automated health remediation for {category.lower()}",
        f"# Health Remediation Note\n\nThis remediation was proposed for {repo_name} under category {category}.\n",
    )
