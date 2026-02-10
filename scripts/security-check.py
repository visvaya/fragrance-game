#!/usr/bin/env python3
"""
Pre-edit security check hook.
Blocks edits that might contain secrets or security issues.
"""
import json
import logging
import re
import sys
import os
from typing import List, Tuple, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Patterns that indicate potential security issues (other than secrets)
SECURITY_PATTERNS: List[Tuple[str, str]] = [
    # Absolute Paths (Windows) - Including common drive letters and user/system folders
    (r'(?i)[A-Z]:\\(?:Users|Windows|Program Files|fragrance-game)', "Absolute Windows path (privacy/portability)"),
    # Absolute Paths (Linux/Mac)
    (r'(?i)/(?:Users|home)/[a-zA-Z0-9._-]+', "Absolute Unix path (privacy/portability)"),
    # dangerouslySetInnerHTML without sanitize (Negative lookahead for DOMPurify)
    (r'dangerouslySetInnerHTML.*(?!=.*DOMPurify\.sanitize)', "Potential XSS via dangerouslySetInnerHTML without sanitization"),
]

def check_for_security_issues(content: str) -> List[str]:
    """Check content for non-secret security issues like absolute paths."""
    issues: List[str] = []
    for pattern, issue_type in SECURITY_PATTERNS:
        matches = re.findall(pattern, content)
        if matches:
            issues.append(f"{issue_type} detected")
    return issues

def check_for_secrets(content: str, file_path: str) -> List[str]:
    """
    Check content for potential secrets and security issues.
    
    Args:
        content: The text content to scan.
        file_path: Path to the file being checked.
        
    Returns:
        List of issues found.
    """
    issues: List[str] = []

    # Skip certain files
    if os.path.basename(file_path) in SKIP_FILES:
        return issues

    # Skip test files checking for secret patterns
    if "test" in file_path.lower() or "spec" in file_path.lower():
        # But still check for absolute paths in tests if it's not a mock
        if "mock" not in file_path.lower():
            issues.extend(check_for_security_issues(content))
        return issues

    # Check for secrets
    for pattern, secret_type in SECRET_PATTERNS:
        matches = re.findall(pattern, content)
        if matches:
            issues.append(f"Potential {secret_type} detected")

    # Check for other security issues
    issues.extend(check_for_security_issues(content))

    return issues


def main() -> None:
    """Entry point for the security check script."""
    try:
        file_path = ""
        content = ""

        # Check if arguments are provided directly
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
        # Fallback to stdin JSON (hook style)
        elif not sys.stdin.isatty():
            try:
                input_data = json.load(sys.stdin)
                tool_input = input_data.get("tool_input", {})
                file_path = tool_input.get("file_path", "")
                content = tool_input.get("content", "") or tool_input.get("new_string", "")
            except json.JSONDecodeError:
                pass

        if not file_path or not content:
            # If no file/content provided, nothing to check
            sys.exit(0)

        issues = check_for_secrets(content, file_path)

        if issues:
            logger.error(f"🚫 BLOCKED - Security issue detected in {file_path}:")
            for issue in issues:
                logger.error(f"  - {issue}")
            logger.info("\nThis edit has been BLOCKED to prevent committing secrets.")
            logger.info("If this is a false positive, review and adjust the patterns in security-check.py")
            # Exit 2 to block (common convention for hooks)
            sys.exit(2)

        sys.exit(0)

    except Exception as e:
        # Don't block on errors during script execution
        logger.debug(f"Error: {e}")
        sys.exit(0)


if __name__ == "__main__":
    main()
