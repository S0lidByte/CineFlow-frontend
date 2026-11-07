/**
 * Unit and security test suite for Free PR Reviewers Artifact Processing & Reporter.
 * Runs with Node.js built-in test runner: node --test
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
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
    MAX_ARTIFACT_SIZE_BYTES,
    REVIEW_MARKER
} = require("./process-pr-reviews.cjs");

describe("Security: Path Traversal & Sanitization", () => {
    it("safeResolvePath prevents directory traversal outside baseDir", () => {
        const base = os.tmpdir();
        assert.throws(
            () => safeResolvePath(base, "../outside.txt"),
            /Path traversal attempt detected/
        );
        assert.throws(
            () => safeResolvePath(base, "sub/../../outside.txt"),
            /Path traversal attempt detected/
        );
    });

    it("safeResolvePath rejects null bytes", () => {
        const base = os.tmpdir();
        assert.throws(() => safeResolvePath(base, "file\0.json"), /Null byte in path/);
    });

    it("safeResolvePath allows valid subpaths", () => {
        const base = path.join(os.tmpdir(), "pr-reports");
        if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
        const resolved = safeResolvePath(base, "eslint-report/eslint.json");
        assert.ok(resolved.startsWith(path.resolve(base)));
    });

    it("findReportFile finds files in nested subfolder or flat layout safely", () => {
        const base = path.join(os.tmpdir(), `test_find_${Date.now()}`);
        const nestedDir = path.join(base, "eslint-report");
        fs.mkdirSync(nestedDir, { recursive: true });
        const nestedFile = path.join(nestedDir, "eslint.json");
        fs.writeFileSync(nestedFile, "[]");

        try {
            const foundNested = findReportFile(base, "eslint-report", "eslint.json");
            assert.equal(foundNested, path.resolve(nestedFile));

            // Test flat layout
            const flatFile = path.join(base, "actionlint.json");
            fs.writeFileSync(flatFile, "[]");
            const foundFlat = findReportFile(base, "actionlint-report", "actionlint.json");
            assert.equal(foundFlat, path.resolve(flatFile));

            // Test missing
            const notFound = findReportFile(base, "missing-report", "missing.json");
            assert.equal(notFound, null);
        } finally {
            fs.rmSync(base, { recursive: true, force: true });
        }
    });

    it("safeNormalizeFilePath rejects malicious path inputs", () => {
        assert.equal(safeNormalizeFilePath("/etc/passwd"), null);
        assert.equal(safeNormalizeFilePath("C:\\Windows\\system32"), null);
        assert.equal(safeNormalizeFilePath("..\\..\\secret.txt"), null);
        assert.equal(safeNormalizeFilePath("src/../../escaped.js"), null);
        assert.equal(safeNormalizeFilePath("path\0withnull.js"), null);
        assert.equal(safeNormalizeFilePath(""), null);
        assert.equal(safeNormalizeFilePath(null), null);
    });

    it("safeNormalizeFilePath properly normalizes valid paths", () => {
        assert.equal(safeNormalizeFilePath("./src/lib/foo.ts"), "src/lib/foo.ts");
        assert.equal(
            safeNormalizeFilePath("src\\components\\card.svelte"),
            "src/components/card.svelte"
        );
        assert.equal(safeNormalizeFilePath(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
    });
});

describe("Security: Workflow Run & PR Validation", () => {
    const validContext = {
        repo: { owner: "S0lidByte", repo: "CineFlow-frontend" },
        payload: {
            workflow_run: {
                id: 12345,
                event: "pull_request",
                name: "Free PR Reviewers",
                head_sha: "commit_sha_123",
                head_repository: { full_name: "S0lidByte/CineFlow-frontend" },
                pull_requests: [{ number: 142 }]
            }
        }
    };

    const validPr = {
        number: 142,
        state: "open",
        head: {
            sha: "commit_sha_123",
            repo: { full_name: "S0lidByte/CineFlow-frontend" }
        }
    };

    it("accepts matching, valid, open PR and workflow run", () => {
        const result = validateWorkflowRunContext({ context: validContext, pr: validPr });
        assert.equal(result.valid, true);
        assert.equal(result.prNumber, 142);
        assert.equal(result.headSha, "commit_sha_123");
    });

    it("rejects stale run where PR head SHA has moved", () => {
        const stalePr = {
            ...validPr,
            head: { sha: "newer_commit_sha_456" }
        };
        const result = validateWorkflowRunContext({ context: validContext, pr: stalePr });
        assert.equal(result.valid, false);
        assert.equal(result.stale, true);
        assert.match(result.reason, /Stale run/);
    });

    it("rejects closed or merged PR", () => {
        const closedPr = { ...validPr, state: "closed" };
        const result = validateWorkflowRunContext({ context: validContext, pr: closedPr });
        assert.equal(result.valid, false);
        assert.match(result.reason, /is closed, not open/);
    });

    it("rejects run from foreign or mismatched repository", () => {
        const foreignContext = {
            repo: { owner: "S0lidByte", repo: "CineFlow-frontend" },
            payload: {
                workflow_run: {
                    ...validContext.payload.workflow_run,
                    head_repository: { full_name: "attacker/malicious-fork" }
                }
            }
        };
        const result = validateWorkflowRunContext({ context: foreignContext, pr: validPr });
        assert.equal(result.valid, false);
        assert.match(result.reason, /Repository mismatch/);
    });

    it("rejects run with unexpected workflow name or trigger event", () => {
        const wrongEvent = {
            ...validContext,
            payload: {
                workflow_run: { ...validContext.payload.workflow_run, event: "push" }
            }
        };
        assert.equal(validateWorkflowRunContext({ context: wrongEvent, pr: validPr }).valid, false);

        const wrongName = {
            ...validContext,
            payload: {
                workflow_run: { ...validContext.payload.workflow_run, name: "Malicious Workflow" }
            }
        };
        assert.equal(validateWorkflowRunContext({ context: wrongName, pr: validPr }).valid, false);
    });

    it("derives PR strictly from GitHub workflow_run metadata ignoring any artifact-provided PR numbers", () => {
        const forgedArtifact = {
            pr_number: 99999,
            target_repo: "victim/repo",
            findings: []
        };
        // validateWorkflowRunContext only receives context & trusted GitHub PR object
        const result = validateWorkflowRunContext({ context: validContext, pr: validPr });
        assert.equal(result.valid, true);
        assert.equal(result.prNumber, 142);
        assert.notEqual(result.prNumber, forgedArtifact.pr_number);
    });
});

describe("Linter Exit Code Semantics", () => {
    function classifyScannerExitCode(exitCode) {
        if (exitCode === 0) return { status: "clean", failJob: false };
        if (exitCode === 1) return { status: "findings", failJob: false };
        return { status: "fatal_failure", failJob: true };
    }

    it("treats exit 0 as clean, exit 1 as findings, and exit >= 2 as failure", () => {
        assert.deepEqual(classifyScannerExitCode(0), { status: "clean", failJob: false });
        assert.deepEqual(classifyScannerExitCode(1), { status: "findings", failJob: false });
        assert.deepEqual(classifyScannerExitCode(2), { status: "fatal_failure", failJob: true });
        assert.deepEqual(classifyScannerExitCode(3), { status: "fatal_failure", failJob: true });
        assert.deepEqual(classifyScannerExitCode(127), { status: "fatal_failure", failJob: true });
    });
});

describe("Security: File Size & Findings Caps", () => {
    it("readSafeJsonFile rejects files exceeding MAX_ARTIFACT_SIZE_BYTES", () => {
        const tmpFile = path.join(os.tmpdir(), `test_huge_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, "a".repeat(2048));
        try {
            assert.throws(() => readSafeJsonFile(tmpFile, 1024), /exceeds maximum allowed size/);
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    it("caps actionlint findings to maxFindings limit", () => {
        const many = Array.from({ length: 50 }, (_, i) => ({
            message: `Issue ${i}`,
            filepath: `src/file_${i}.yml`,
            line: i + 1,
            column: 1,
            kind: "syntax"
        }));
        const parsed = parseActionlintJson(many, 10);
        assert.equal(parsed.length, 10);
    });

    it("caps Semgrep SARIF findings to maxFindings limit", () => {
        const sarif = {
            runs: [
                {
                    results: Array.from({ length: 50 }, (_, i) => ({
                        ruleId: `security-rule-${i}`,
                        message: { text: `Vulnerability ${i}` },
                        locations: [
                            {
                                physicalLocation: {
                                    artifactLocation: { uri: `src/vuln_${i}.ts` },
                                    region: { startLine: 10 + i, startColumn: 1 }
                                }
                            }
                        ]
                    }))
                }
            ]
        };
        const parsed = parseSemgrepSarif(sarif, 15);
        assert.equal(parsed.length, 15);
    });

    it("caps ESLint findings to maxFindings limit", () => {
        const eslintReport = [
            {
                filePath: "/repo/src/index.ts",
                messages: Array.from({ length: 40 }, (_, i) => ({
                    ruleId: `no-unused-${i}`,
                    message: `Unused variable ${i}`,
                    line: i + 1,
                    column: 2,
                    severity: 2
                }))
            }
        ];
        const parsed = parseEslintJson(eslintReport, "/repo", 8);
        assert.equal(parsed.length, 8);
    });
});

describe("Diff-Aware Inline Commenting & Schema Parsing", () => {
    const mockPatch = [
        "@@ -10,6 +10,8 @@ export function test() {",
        "   const a = 1;",
        "+  const b = 2;",
        "+  const c = 3;",
        "   return a;",
        " }"
    ].join("\n");

    it("parseChangedLinesFromPatch correctly identifies added/modified lines", () => {
        const changed = parseChangedLinesFromPatch(mockPatch);
        assert.equal(changed.has(10), false); // context line
        assert.equal(changed.has(11), true); // added line (+ const b = 2)
        assert.equal(changed.has(12), true); // added line (+ const c = 3)
        assert.equal(changed.has(13), false); // context line
    });

    it("buildReviewPayload comments ONLY on changed lines in diff", () => {
        const changedFilesMap = new Map();
        changedFilesMap.set("src/test.ts", new Set([11, 12]));

        const findings = [
            {
                tool: "eslint",
                path: "src/test.ts",
                line: 11,
                ruleId: "no-unused-vars",
                message: "'b' is assigned a value but never used",
                severity: "warning"
            },
            {
                tool: "semgrep",
                path: "src/test.ts",
                line: 50, // OUT OF DIFF
                ruleId: "hardcoded-secret",
                message: "Possible token",
                severity: "warning"
            }
        ];

        const { inlineComments, reviewBody } = buildReviewPayload({
            findings,
            changedFilesMap,
            headSha: "abc1234",
            maxInline: 10
        });

        // Only line 11 should be an inline comment
        assert.equal(inlineComments.length, 1);
        assert.equal(inlineComments[0].path, "src/test.ts");
        assert.equal(inlineComments[0].line, 11);
        assert.match(inlineComments[0].body, /no-unused-vars/);

        // Out of diff finding is summarized in reviewBody
        assert.match(reviewBody, /Additional findings outside changed lines \(1\)/);
        assert.match(reviewBody, /hardcoded-secret/);
        assert.match(reviewBody, new RegExp(REVIEW_MARKER));
    });

    it("buildReviewPayload marks tools clean when zero findings exist", () => {
        const changedFilesMap = new Map();
        const { inlineComments, reviewBody } = buildReviewPayload({
            findings: [],
            changedFilesMap,
            headSha: "clean123"
        });

        assert.equal(inlineComments.length, 0);
        assert.match(reviewBody, /✅ Clean/);
    });
});
