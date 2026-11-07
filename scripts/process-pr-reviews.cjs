/**
 * Free PR Reviewers - Trusted Artifact Processing & PR Review Reporter
 *
 * This script runs strictly in the trusted default-branch workflow_run context.
 * It executes NO PR code, checks out NO PR branches, and applies strict security
 * boundaries:
 * 1. Derives PR identity strictly from GitHub workflow_run metadata (never from artifacts).
 * 2. Validates run context: same repository, matching head SHA, open PR state.
 * 3. Enforces strict path traversal defenses on artifact filenames and reported paths.
 * 4. Caps file sizes and maximum findings to prevent denial-of-service/spam.
 * 5. Uses strict schema parsers for actionlint, Semgrep SARIF, and ESLint JSON.
 * 6. Filters findings against the PR diff: ONLY comments on added/modified lines.
 * 7. Reports findings non-blocking via Octokit createReview.
 */

const fs = require('node:fs');
const path = require('node:path');

const MAX_ARTIFACT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FINDINGS_PER_TOOL = 25;
const MAX_TOTAL_INLINE_COMMENTS = 30;
const REVIEW_MARKER = '<!-- cineflow-free-pr-reviewers -->';

/**
 * Validates workflow_run context and PR state.
 */
function validateWorkflowRunContext({ context, pr }) {
    if (!context || !context.payload || !context.payload.workflow_run) {
        return { valid: false, reason: 'Missing workflow_run payload in context' };
    }

    const run = context.payload.workflow_run;

    if (run.event !== 'pull_request') {
        return { valid: false, reason: `Invalid trigger event: ${run.event} (expected pull_request)` };
    }

    if (run.name !== 'Free PR Reviewers') {
        return { valid: false, reason: `Unexpected workflow name: ${run.name}` };
    }

    const currentRepo = context.repo ? `${context.repo.owner}/${context.repo.repo}` : null;
    const runRepo = run.head_repository ? run.head_repository.full_name : null;

    if (!currentRepo || runRepo !== currentRepo) {
        return { valid: false, reason: `Repository mismatch: run from ${runRepo}, current is ${currentRepo}` };
    }

    if (!pr) {
        return { valid: false, reason: 'Missing PR object for validation' };
    }

    if (pr.state !== 'open') {
        return { valid: false, reason: `PR #${pr.number} is ${pr.state}, not open` };
    }

    if (pr.head.sha !== run.head_sha) {
        return {
            valid: false,
            stale: true,
            reason: `Stale run: workflow head SHA (${run.head_sha}) does not match current PR head SHA (${pr.head.sha})`
        };
    }

    return { valid: true, prNumber: pr.number, headSha: run.head_sha };
}

/**
 * Resolves a file safely inside a base directory, rejecting path traversal.
 */
function safeResolvePath(baseDir, relativePath) {
    if (!baseDir || !relativePath) {
        throw new Error('baseDir and relativePath are required');
    }
    if (relativePath.includes('\0')) {
        throw new Error('Null byte in path');
    }
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, relativePath);

    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
        throw new Error(`Path traversal attempt detected: ${relativePath}`);
    }

    return resolvedTarget;
}

/**
 * Sanitizes and normalizes a relative file path from linter output.
 * Rejects absolute paths, drive letters, path traversals, or null bytes.
 */
function safeNormalizeFilePath(rawPath) {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
        return null;
    }
    if (rawPath.includes('\0')) {
        return null;
    }

    let normalized = rawPath.replace(/\\/g, '/').trim();

    // Strip leading ./
    while (normalized.startsWith('./')) {
        normalized = normalized.slice(2);
    }

    // Reject absolute paths (UNIX or Windows drive letter) or traversal
    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.includes('..')) {
        return null;
    }

    return normalized;
}

/**
 * Checks file size before reading.
 */
function readSafeJsonFile(filePath, maxSize = MAX_ARTIFACT_SIZE_BYTES) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }
    const stat = fs.statSync(filePath);
    if (stat.size > maxSize) {
        throw new Error(`File size ${stat.size} exceeds maximum allowed size ${maxSize}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
        return null;
    }
    return JSON.parse(content);
}

/**
 * Searches for a report file either within an artifact subfolder or at root of reportsDir.
 */
function findReportFile(reportsDir, subDir, fileName) {
    try {
        const candidateSub = safeResolvePath(reportsDir, path.join(subDir, fileName));
        if (fs.existsSync(candidateSub)) {
            return candidateSub;
        }
    } catch {
        // Ignored, try root candidate
    }
    try {
        const candidateRoot = safeResolvePath(reportsDir, fileName);
        if (fs.existsSync(candidateRoot)) {
            return candidateRoot;
        }
    } catch {
        // Ignored
    }
    return null;
}

/**
 * Parses actionlint JSON output.
 * Format: array of { message, filepath, line, column, kind, snippet }
 */
function parseActionlintJson(data, maxFindings = MAX_FINDINGS_PER_TOOL) {
    if (!data) return [];
    if (!Array.isArray(data)) {
        throw new Error('Actionlint report must be a JSON array');
    }

    const findings = [];
    for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        const normPath = safeNormalizeFilePath(item.filepath);
        if (!normPath) continue;

        const line = Number.parseInt(item.line, 10);
        if (Number.isNaN(line) || line < 1) continue;

        findings.push({
            tool: 'actionlint',
            path: normPath,
            line,
            column: Number.parseInt(item.column, 10) || 1,
            ruleId: typeof item.kind === 'string' && item.kind ? item.kind : 'actionlint',
            message: typeof item.message === 'string' ? item.message.trim() : 'Workflow syntax issue',
            severity: 'error'
        });

        if (findings.length >= maxFindings) break;
    }

    return findings;
}

/**
 * Parses Semgrep SARIF 2.1.0 output.
 * Format: { runs: [ { results: [ { ruleId, message: { text }, locations: [ ... ] } ] } ] }
 */
function parseSemgrepSarif(data, maxFindings = MAX_FINDINGS_PER_TOOL) {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.runs)) {
        throw new Error('Semgrep SARIF must contain runs array');
    }

    const findings = [];
    for (const run of data.runs) {
        if (!run || !Array.isArray(run.results)) continue;
        for (const res of run.results) {
            if (!res || typeof res !== 'object') continue;

            const ruleId = typeof res.ruleId === 'string' ? res.ruleId : 'semgrep-finding';
            const message = res.message && typeof res.message.text === 'string' ? res.message.text.trim() : 'Security finding';

            const loc = Array.isArray(res.locations) && res.locations[0] ? res.locations[0].physicalLocation : null;
            if (!loc) continue;

            const uri = loc.artifactLocation && typeof loc.artifactLocation.uri === 'string' ? loc.artifactLocation.uri : null;
            const normPath = safeNormalizeFilePath(uri);
            if (!normPath) continue;

            const line = loc.region && Number.isInteger(loc.region.startLine) ? loc.region.startLine : 1;
            const column = loc.region && Number.isInteger(loc.region.startColumn) ? loc.region.startColumn : 1;

            findings.push({
                tool: 'semgrep',
                path: normPath,
                line: Math.max(1, line),
                column: Math.max(1, column),
                ruleId,
                message,
                severity: 'warning'
            });

            if (findings.length >= maxFindings) break;
        }
        if (findings.length >= maxFindings) break;
    }

    return findings;
}

/**
 * Parses ESLint JSON output.
 * Format: array of { filePath, messages: [ { ruleId, message, line, column, severity } ] }
 */
function parseEslintJson(data, repoRoot = '', maxFindings = MAX_FINDINGS_PER_TOOL) {
    if (!data) return [];
    if (!Array.isArray(data)) {
        throw new Error('ESLint report must be a JSON array');
    }

    const findings = [];
    const normalizedRepoRoot = repoRoot ? repoRoot.replace(/\\/g, '/').replace(/\/+$/, '') : '';

    for (const fileResult of data) {
        if (!fileResult || typeof fileResult !== 'object' || !Array.isArray(fileResult.messages)) {
            continue;
        }

        let relPath = fileResult.filePath ? String(fileResult.filePath).replace(/\\/g, '/') : '';
        if (normalizedRepoRoot && relPath.startsWith(normalizedRepoRoot)) {
            relPath = relPath.slice(normalizedRepoRoot.length);
        }
        while (relPath.startsWith('/')) {
            relPath = relPath.slice(1);
        }

        const normPath = safeNormalizeFilePath(relPath);
        if (!normPath) continue;

        for (const msg of fileResult.messages) {
            if (!msg || typeof msg !== 'object') continue;

            const line = Number.parseInt(msg.line, 10);
            if (Number.isNaN(line) || line < 1) continue;

            const column = Number.parseInt(msg.column, 10) || 1;
            const ruleId = msg.ruleId || 'eslint';
            const message = typeof msg.message === 'string' ? msg.message.trim() : 'ESLint warning/error';
            const severity = msg.severity === 2 ? 'error' : 'warning';

            findings.push({
                tool: 'eslint',
                path: normPath,
                line,
                column,
                ruleId,
                message,
                severity
            });

            if (findings.length >= maxFindings) break;
        }
        if (findings.length >= maxFindings) break;
    }

    return findings;
}

/**
 * Parses a unified diff patch string into a Set of 1-based changed line numbers (additions/modifications) in the new file.
 */
function parseChangedLinesFromPatch(patch) {
    const changed = new Set();
    if (typeof patch !== 'string' || !patch.trim()) {
        return changed;
    }

    const lines = patch.split('\n');
    let currentLine = 0;

    for (const line of lines) {
        if (line.startsWith('@@')) {
            // @@ -from,len +to,len @@
            const match = line.match(/\+([0-9]+)(?:,([0-9]+))?/);
            if (match) {
                currentLine = Number.parseInt(match[1], 10);
            }
        } else if (line.startsWith('+')) {
            changed.add(currentLine);
            currentLine++;
        } else if (line.startsWith('-')) {
            // Deleted line, does not advance target line number
        } else {
            // Context line
            currentLine++;
        }
    }

    return changed;
}

/**
 * Builds the PR review payload with inline comments for changed lines and a summary table.
 */
function buildReviewPayload({
    findings,
    changedFilesMap,
    headSha,
    maxInline = MAX_TOTAL_INLINE_COMMENTS
}) {
    const inlineComments = [];
    const outOfDiff = [];

    const stats = {
        actionlint: { total: 0, inDiff: 0 },
        semgrep: { total: 0, inDiff: 0 },
        eslint: { total: 0, inDiff: 0 }
    };

    for (const item of findings) {
        if (!stats[item.tool]) {
            stats[item.tool] = { total: 0, inDiff: 0 };
        }
        stats[item.tool].total++;

        const fileChangedLines = changedFilesMap.get(item.path);
        const isLineInDiff = fileChangedLines && fileChangedLines.has(item.line);

        if (isLineInDiff && inlineComments.length < maxInline) {
            stats[item.tool].inDiff++;
            inlineComments.push({
                path: item.path,
                line: item.line,
                body: `**[${item.tool}]** \`${item.ruleId}\` (${item.severity}):\n${item.message}`
            });
        } else {
            outOfDiff.push(item);
        }
    }

    let summary = `### Free PR Reviewers Static Analysis Report\n\n`;
    summary += `${REVIEW_MARKER}\n`;
    summary += `Analyzed commit: \`${headSha}\`\n\n`;
    summary += `| Tool | Total Findings | Inline on Diff | Status |\n`;
    summary += `| :--- | :--- | :--- | :--- |\n`;

    for (const tool of ['actionlint', 'semgrep', 'eslint']) {
        const s = stats[tool] || { total: 0, inDiff: 0 };
        const status = s.total === 0 ? '✅ Clean' : `⚠️ ${s.total} finding(s)`;
        summary += `| **${tool}** | ${s.total} | ${s.inDiff} | ${status} |\n`;
    }

    if (outOfDiff.length > 0) {
        summary += `\n<details><summary><strong>Additional findings outside changed lines (${outOfDiff.length})</strong></summary>\n\n`;
        for (const item of outOfDiff.slice(0, 15)) {
            summary += `- \`${item.path}:${item.line}\` **[${item.tool}]** \`${item.ruleId}\`: ${item.message}\n`;
        }
        if (outOfDiff.length > 15) {
            summary += `- ... and ${outOfDiff.length - 15} more\n`;
        }
        summary += `\n</details>\n`;
    }

    return { inlineComments, reviewBody: summary };
}

/**
 * Main runner function intended for actions/github-script execution.
 */
async function runReporter({ github, context, core, reportsDir = 'pr-reports' }) {
    const run = context.payload && context.payload.workflow_run;
    if (!run) {
        core.setFailed('Missing workflow_run payload in context');
        return;
    }

    const prNumber = run.pull_requests && run.pull_requests[0] ? run.pull_requests[0].number : null;
    if (!prNumber) {
        core.info('No pull request associated with workflow_run; skipping report.');
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Fetch PR from GitHub API to verify current status and head SHA
    const { data: pr } = await github.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
    });

    const validation = validateWorkflowRunContext({ context, pr });
    if (!validation.valid) {
        if (validation.stale) {
            core.info(`Skipping report: ${validation.reason}`);
            return;
        }
        core.setFailed(`Validation failed: ${validation.reason}`);
        return;
    }

    // Check if an existing review was already posted on this commit
    const { data: existingReviews } = await github.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber
    });

    const alreadyReviewed = existingReviews.some(
        (rev) => rev.commit_id === run.head_sha && rev.body && rev.body.includes(REVIEW_MARKER)
    );
    if (alreadyReviewed) {
        core.info(`PR #${prNumber} already has static analysis review for ${run.head_sha}; skipping.`);
        return;
    }

    // Query changed files in PR to build diff filter
    const changedFilesMap = new Map();
    const { data: prFiles } = await github.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100
    });

    for (const f of prFiles) {
        changedFilesMap.set(f.filename, parseChangedLinesFromPatch(f.patch));
    }

    // Locate and parse report artifacts safely
    const allFindings = [];

    // 1. Actionlint
    try {
        const p = findReportFile(reportsDir, 'actionlint-report', 'actionlint.json');
        const data = readSafeJsonFile(p);
        if (data) {
            allFindings.push(...parseActionlintJson(data));
        }
    } catch (err) {
        core.info(`Actionlint report not found or skipped: ${err.message}`);
    }

    // 2. Semgrep
    try {
        const p = findReportFile(reportsDir, 'semgrep-report', 'semgrep.sarif');
        const data = readSafeJsonFile(p);
        if (data) {
            allFindings.push(...parseSemgrepSarif(data));
        }
    } catch (err) {
        core.info(`Semgrep report not found or skipped: ${err.message}`);
    }

    // 3. ESLint
    try {
        const p = findReportFile(reportsDir, 'eslint-report', 'eslint.json');
        const data = readSafeJsonFile(p);
        if (data) {
            allFindings.push(...parseEslintJson(data, process.cwd()));
        }
    } catch (err) {
        core.info(`ESLint report not found or skipped: ${err.message}`);
    }

    const { inlineComments, reviewBody } = buildReviewPayload({
        findings: allFindings,
        changedFilesMap,
        headSha: run.head_sha
    });

    // Post review non-blocking
    try {
        await github.rest.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            commit_id: run.head_sha,
            event: 'COMMENT',
            body: reviewBody,
            comments: inlineComments.length > 0 ? inlineComments : undefined
        });
        core.info(`Posted review on PR #${prNumber} with ${inlineComments.length} inline comments.`);
    } catch (postErr) {
        core.warning(`Failed to post inline review comments: ${postErr.message}. Retrying with summary body only.`);
        try {
            await github.rest.pulls.createReview({
                owner,
                repo,
                pull_number: prNumber,
                commit_id: run.head_sha,
                event: 'COMMENT',
                body: reviewBody
            });
        } catch (retryErr) {
            core.warning(`Failed to post review summary: ${retryErr.message}`);
        }
    }
}

module.exports = {
    validateWorkflowRunContext,
    safeResolvePath,
    safeNormalizeFilePath,
    findReportFile,
    readSafeJsonFile,
    parseActionlintJson,
    parseSemgrepSarif,
    parseEslintJson,
    parseChangedLinesFromPatch,
    buildReviewPayload,
    runReporter,
    REVIEW_MARKER,
    MAX_ARTIFACT_SIZE_BYTES,
    MAX_FINDINGS_PER_TOOL,
    MAX_TOTAL_INLINE_COMMENTS
};
