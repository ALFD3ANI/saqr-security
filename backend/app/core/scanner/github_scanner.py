"""
GitHub Scanner — فحص مستودعات GitHub بحثاً عن أسرار وثغرات
يستخدم GitHub Public API (لا يحتاج مصادقة للمستودعات العامة)
"""
import re
import json
from typing import Optional

import httpx

from .base import Finding, ScanResult

GITHUB_API = "https://api.github.com"

SECRET_PATTERNS = [
    (r'(?i)password\s*[=:]\s*["\'][^"\']{4,}["\']',      "critical", "Hardcoded Password"),
    (r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\'][a-z0-9\-_]{16,}["\']', "critical", "Hardcoded API Key"),
    (r'(?i)(?:secret|access_token)\s*[=:]\s*["\'][^"\']{16,}["\']', "critical", "Hardcoded Token"),
    (r'AKIA[0-9A-Z]{16}',                                  "critical", "AWS Access Key"),
    (r'ghp_[a-zA-Z0-9]{36}',                               "critical", "GitHub PAT"),
    (r'sk-[a-zA-Z0-9]{48}',                                "critical", "OpenAI Key"),
    (r'sk_live_[a-zA-Z0-9]{24,}',                         "critical", "Stripe Live Key"),
    (r'-----BEGIN (?:RSA )?PRIVATE KEY',                   "critical", "Private Key"),
    (r'(?i)(?:db_pass|database_password)\s*[=:]\s*["\'][^"\']{3,}["\']', "high", "DB Password"),
]

SENSITIVE_FILES = [
    ".env", ".env.local", ".env.production",
    "id_rsa", "id_dsa", "*.pem", "*.key", "*.pfx", "*.p12",
    "config/secrets.yml", "config/database.yml",
    "wp-config.php", "settings.py", "local_settings.py",
    ".htpasswd", "*.sql", "dump.sql",
]

VULN_DEPS = {
    "package.json":       "npm",
    "requirements.txt":   "python",
    "Gemfile":            "ruby",
    "composer.json":      "php",
    "pom.xml":            "java",
}


def _parse_repo(repo_input: str) -> Optional[tuple[str, str]]:
    """استخراج owner/repo من URL أو نص"""
    repo_input = repo_input.strip()
    # github.com/owner/repo
    m = re.search(r'github\.com[/:]([^/\s]+)/([^/\s]+?)(?:\.git)?(?:/|$)', repo_input)
    if m:
        return m.group(1), m.group(2)
    # owner/repo
    if re.match(r'^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$', repo_input):
        parts = repo_input.split("/")
        return parts[0], parts[1]
    return None


async def scan_github(repo_input: str, progress_cb=None) -> ScanResult:
    result = ScanResult()

    parsed = _parse_repo(repo_input)
    if not parsed:
        result.error = "Invalid GitHub repository URL or owner/repo format"
        return result

    owner, repo = parsed
    repo = repo[:-4] if repo.endswith(".git") else repo

    if progress_cb: await progress_cb(10, f"Fetching repository info: {owner}/{repo}...")

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SaqrScanner/1.0",
    }

    async with httpx.AsyncClient(timeout=12.0) as client:

        # ── 1. Repo Info ────────────────────────────────────
        try:
            repo_resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
        except Exception as e:
            result.error = f"GitHub API error: {str(e)[:150]}"
            return result

        if repo_resp.status_code == 404:
            result.error = "Repository not found or private (unauthenticated access)"
            return result
        if repo_resp.status_code == 403:
            result.error = "GitHub API rate limit exceeded. Try again in a few minutes."
            return result
        if repo_resp.status_code != 200:
            result.error = f"GitHub API returned HTTP {repo_resp.status_code}"
            return result

        repo_data = repo_resp.json()
        is_private = repo_data.get("private", False)
        default_branch = repo_data.get("default_branch", "main")
        stars = repo_data.get("stargazers_count", 0)
        size_kb = repo_data.get("size", 0)

        result.findings.append(Finding(
            severity="info", category="info",
            title=f"Repository: {owner}/{repo}",
            title_ar=f"المستودع: {owner}/{repo}",
            description=f"Repository found. Stars: {stars} | Size: {size_kb} KB | Branch: {default_branch}",
            recommendation="",
            evidence=f"Visibility: {'Private' if is_private else 'Public'} | Language: {repo_data.get('language','?')}",
        ))

        if not is_private:
            result.findings.append(Finding(
                severity="info", category="config",
                title="Public Repository",
                title_ar="المستودع عام",
                description="This repository is publicly visible. All code and history is accessible to anyone.",
                recommendation="Ensure no secrets, credentials, or sensitive configs are committed.",
            ))

        if progress_cb: await progress_cb(25, "Checking repository files...")

        # ── 2. Check File Tree for Sensitive Files ───────────
        try:
            tree_resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
                headers=headers
            )
            if tree_resp.status_code == 200:
                tree = tree_resp.json().get("tree", [])
                all_paths = [item["path"] for item in tree if item.get("type") == "blob"]

                found_sensitive = []
                for path in all_paths:
                    fname = path.split("/")[-1].lower()
                    for sensitive in SENSITIVE_FILES:
                        if sensitive.startswith("*"):
                            ext = sensitive[1:]
                            if fname.endswith(ext):
                                found_sensitive.append(path)
                                break
                        elif fname == sensitive or path.endswith("/" + sensitive) or path == sensitive:
                            found_sensitive.append(path)
                            break

                if found_sensitive:
                    result.findings.append(Finding(
                        severity="critical" if any(".env" in p or "id_rsa" in p for p in found_sensitive) else "high",
                        category="secrets",
                        title=f"Sensitive Files in Repository ({len(found_sensitive)})",
                        title_ar=f"ملفات حساسة في المستودع ({len(found_sensitive)})",
                        description="The following sensitive files were found in the repository tree:",
                        recommendation="Remove these files, rotate any exposed credentials, and add them to .gitignore.",
                        cwe_id="CWE-312",
                        evidence="\n".join(found_sensitive[:15]),
                    ))

                # Check for dependency files
                dep_files = [p for p in all_paths if any(p.endswith(d) for d in VULN_DEPS)]
                if dep_files:
                    result.findings.append(Finding(
                        severity="info", category="deps",
                        title="Dependency Manifests Found",
                        title_ar="ملفات تبعيات موجودة",
                        description=f"Found {len(dep_files)} dependency file(s). Consider running a vulnerability scanner.",
                        recommendation="Use tools like 'npm audit', 'pip-audit', or GitHub Dependabot to check for vulnerable dependencies.",
                        evidence="\n".join(dep_files[:10]),
                    ))

                # Check for large files (may contain sensitive data/binaries)
                large = [item["path"] for item in tree if item.get("size", 0) > 10_000_000]  # > 10MB
                if large:
                    result.findings.append(Finding(
                        severity="low", category="config",
                        title=f"Large Files in Repository ({len(large)})",
                        title_ar=f"ملفات كبيرة في المستودع ({len(large)})",
                        description="Large files were found. These may be binaries or accidentally committed data.",
                        recommendation="Use Git LFS for large files. Ensure binaries/data don't contain sensitive info.",
                        evidence="\n".join(large[:5]),
                    ))
        except Exception:
            pass

        if progress_cb: await progress_cb(50, "Scanning recent commits for secrets...")

        # ── 3. Scan Recent Commits ────────────────────────────
        try:
            commits_resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/commits?per_page=5",
                headers=headers
            )
            if commits_resp.status_code == 200:
                commits = commits_resp.json()
                secret_commits = []

                for commit in commits[:5]:
                    sha = commit.get("sha", "")
                    if not sha:
                        continue
                    diff_resp = await client.get(
                        f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}",
                        headers={**headers, "Accept": "application/vnd.github.v3.diff"},
                    )
                    if diff_resp.status_code == 200:
                        diff_text = diff_resp.text[:30000]
                        for pattern, severity, title in SECRET_PATTERNS[:6]:
                            if re.search(pattern, diff_text):
                                short_sha = sha[:7]
                                commit_msg = commit.get("commit", {}).get("message", "")[:60]
                                secret_commits.append(f"{short_sha}: {commit_msg} [{title}]")
                                break

                if secret_commits:
                    result.findings.append(Finding(
                        severity="critical", category="secrets",
                        title="Secrets Detected in Recent Commits",
                        title_ar="أسرار مكتشفة في الـ commits الأخيرة",
                        description="Potential secrets found in recent commit diffs:",
                        recommendation="Immediately rotate the exposed credentials. Use BFG Repo Cleaner to purge secrets from history.",
                        cwe_id="CWE-312",
                        evidence="\n".join(secret_commits),
                    ))
        except Exception:
            pass

        if progress_cb: await progress_cb(75, "Checking security settings...")

        # ── 4. Security Policy ───────────────────────────────
        try:
            sec_resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/SECURITY.md",
                headers=headers
            )
            if sec_resp.status_code == 404:
                result.findings.append(Finding(
                    severity="low", category="config",
                    title="No SECURITY.md Policy",
                    title_ar="لا توجد سياسة SECURITY.md",
                    description="The repository does not have a security disclosure policy.",
                    recommendation="Add a SECURITY.md file describing how to report vulnerabilities.",
                ))
        except Exception:
            pass

        # ── 5. Checks for .gitignore ─────────────────────────
        try:
            gi_resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/contents/.gitignore",
                headers=headers
            )
            if gi_resp.status_code == 404:
                result.findings.append(Finding(
                    severity="medium", category="config",
                    title="No .gitignore File",
                    title_ar="لا يوجد ملف .gitignore",
                    description="The repository has no .gitignore, increasing risk of accidentally committing sensitive files.",
                    recommendation="Add a comprehensive .gitignore that excludes .env, secrets, build artifacts, and OS files.",
                    cwe_id="CWE-312",
                ))
        except Exception:
            pass

    if progress_cb: await progress_cb(95, "Calculating risk...")
    result.compute_risk()
    return result
