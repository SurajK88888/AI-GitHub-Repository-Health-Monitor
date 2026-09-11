# AI GitHub Repository Health Monitor
## Repository Health Scoring Specification
### Version 1.0.0

## 1. Objective

The platform must calculate a transparent **0–100 Repository Health Score** for every completed scan.

The score must be reproducible, explainable, configurable, and based primarily on measurable repository signals. AI must not arbitrarily determine the numerical score.

---

## 2. Health Categories

The default scoring model contains eight categories:

```text
Security           20%
Code Quality       20%
Dependencies       15%
Documentation      10%
Issues             10%
Pull Requests      10%
Activity            10%
Configuration       5%
                    ----
                    100%
```

Weights must be configurable at workspace level.

The system must validate that active weights total exactly **100%**.

---

## 3. Score Calculation

Each category receives a normalized score from **0–100**.

Overall score:

```text
Overall Score =
Σ(Category Score × Category Weight / 100)
```

Example:

```text
Security       90 × 20% = 18.0
Code Quality   80 × 20% = 16.0
Dependencies   70 × 15% = 10.5
...
```

Final result is rounded consistently according to one documented rule.

Historical scores must retain the scoring-configuration version used to calculate them.

---

## 4. Category Evaluation

### Security

Consider available security signals such as:

- Dependabot/security alerts
- Vulnerable dependencies
- Secret exposure indicators
- Security configuration
- Repository permissions where applicable

Critical security problems must significantly reduce this category.

### Code Quality

Consider measurable indicators such as:

- Static-analysis results
- Complexity where available
- Test presence
- Test coverage where available
- Code-quality warnings
- Large or problematic files

### Dependencies

Consider:

- Outdated dependencies
- Known vulnerable dependencies
- Dependency freshness
- Lock-file presence
- Dependency-management consistency

### Documentation

Consider:

- README presence
- Installation/setup instructions
- Usage documentation
- Contribution guidance
- License
- Documentation completeness

### Issues

Consider:

- Open issue count
- Critical/high-priority issues
- Very old unresolved issues
- Issue response/activity

### Pull Requests

Consider:

- Open PR age
- Stale PRs
- Review activity
- Merge activity
- PR backlog

### Activity

Consider:

- Recent commits
- Recent releases
- Contributor activity
- Repository inactivity
- Development consistency

### Configuration

Consider:

- Branch protection where accessible
- CI/CD configuration
- Issue templates
- PR templates
- Dependabot configuration
- Repository settings

---

## 5. Severity Impact

Findings must use:

```text
Critical
High
Medium
Low
Informational
```

The scoring engine must apply documented penalties or category formulas rather than arbitrary deductions.

Critical findings should have a stronger impact than low-severity findings.

A category may also enforce a **safety cap** when a severe condition exists. For example, a repository with a critical unresolved security problem may not receive a high Security score even if other security signals are positive.

Exact penalty values must be centralized in scoring configuration/code and covered by tests.

---

## 6. Deterministic vs AI Scoring

Deterministic analyzers are the primary source for numerical scoring.

```text
Repository Data
      ↓
Deterministic Analyzers
      ↓
Metrics + Findings
      ↓
Scoring Engine
      ↓
0–100 Score
      ↓
AI Explanation
```

AI may:

- Explain the score
- Summarize major problems
- Prioritize recommendations
- Explain score changes

AI must not silently modify numerical scores.

---

## 7. Score Changes

For every new completed scan, calculate:

```text
Current Score
Previous Score
Difference
Percentage Change
Changed Categories
```

Example:

```text
Health Score: 82 → 74
Change: -8

Main causes:
- Dependencies: -7
- Documentation: -3
- Security: +2
```

The system should identify the findings or metrics responsible for significant score changes.

---

## 8. Score Bands

Use simple health bands for UI presentation:

```text
90–100  Excellent
75–89   Good
60–74   Needs Attention
40–59   Poor
0–39    Critical
```

These labels must be presentation metadata and must not replace the numerical score.

---

## 9. Historical Integrity

Every health-score record must preserve:

- Overall score
- Category scores
- Category weights
- Scoring configuration/version
- Scan ID
- Calculation timestamp

Changing scoring weights must create a new configuration version and must never rewrite historical results.

---

## 10. Scoring Rules

1. Scores must always remain between 0 and 100.
2. Category weights must total 100%.
3. Missing data must not automatically be treated as failure.
4. Unavailable GitHub data must be explicitly marked as unavailable.
5. AI output must not directly determine numerical scores.
6. Scoring calculations must be deterministic and testable.
7. Every score must be explainable through underlying metrics/findings.
8. Historical scores must remain reproducible.
9. Scoring logic must be centralized and version-controlled.
10. Future categories must be addable without redesigning the entire scoring engine.