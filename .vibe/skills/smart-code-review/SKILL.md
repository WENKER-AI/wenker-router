---
name: smart-code-review
description: Load this skill when the user asks you to review, verify, or optimize code before finalizing a task. It handles linting, anti-pattern detection, architecture/style suggestions, and test verification automatically.
user-invocable: true
---

# Smart Code Review Assistant

This skill activates when the user wants a comprehensive review of their code changes before considering a task complete. It ensures higher quality by automating checks that would normally require manual effort.

## When to Load

Load this skill when you see requests like:
- "Review my code"
- "Check before commit"
- "Verify this works"
- "Optimize this"
- "Make this better"
- "Is this code good?"
- Any variant in Vietnamese: "kiểm tra code", "review giùm", "tối ưu code", "chạy test giùm", etc.

## Core Principles

1. **Be proactive** - Don't wait to be asked; if you complete a coding task, run these checks automatically
2. **Be thorough** - Cover linting, patterns, architecture, style, and testing
3. **Be efficient** - Run checks in parallel where possible, skip redundant checks
4. **Be actionable** - Every finding must have a clear fix or improvement suggestion

## Automated Review Workflow

### Phase 1: Static Analysis (Always Run)

**1.1 Linting & Syntax**
- Run `eslint`, `flake8`, `pylint`, `rubocop`, or language-equivalent
- Check for syntax errors, unused variables, undefined references
- Use: `bash: "command": "npm run lint || flake8 . || pylint ..."`

**1.2 Code Quality Metrics**
- Check cyclomatic complexity (aim for < 10)
- Check function length (aim for < 30 lines)
- Check file length (aim for < 300 lines)
- Use: `bash: "command": "radon cc . --average || lizard ..."`

**1.3 Anti-Pattern Detection**
Check for these common issues:

| Anti-Pattern | Detection | Fix |
|--------------|-----------|-----|
| God class/object | File/Class > 500 lines, > 20 methods | Split into smaller modules |
| Magic numbers | Hardcoded numeric values | Use named constants |
| Duplicate code | Same logic in multiple places | Extract to function/module |
| Long parameter list | > 4 parameters | Use object/config pattern |
| Nested callbacks | > 3 levels deep | Use async/await or flatten |
| Primitive obsession | Using strings/numbers for domain concepts | Create dedicated types |
| Feature envy | Method uses other class's data more than own | Move method to that class |
| Switch/case statements | Multiple switch on same value | Use polymorphism/strategy pattern |
| Mutable shared state | Global variables, shared mutable objects | Use immutability, pass copies |
| Error swallowing | Empty catch blocks | At minimum, log the error |

**1.4 Security Checks**
- SQL injection vulnerabilities (raw string concatenation in queries)
- XSS vulnerabilities (unsafe HTML rendering)
- Hardcoded secrets (API keys, passwords)
- Missing input validation
- Use grep: `grep -r "SELECT.*FROM.*WHERE" --include="*.js" --include="*.py" .`

### Phase 2: Architecture & Style Review

**2.1 Code Structure**
- Check separation of concerns (UI vs business vs data layers)
- Verify SOLID principles:
  - Single Responsibility: Each class/function does one thing
  - Open/Closed: Open for extension, closed for modification
  - Liskov Substitution: Subtypes must be substitutable
  - Interface Segregation: Small, specific interfaces
  - Dependency Inversion: Depend on abstractions
- Check for circular dependencies

**2.2 Naming & Readability**
- Function names: should be verbs (getUser, calculateTotal)
- Variable names: should be nouns, descriptive
- Boolean variables: should start with is/has/can (isValid, hasPermission)
- Class names: PascalCase
- Constant names: UPPER_SNAKE_CASE
- Avoid abbreviations unless widely known (id, config, etc.)

**2.3 Consistency Checks**
- Consistent indentation (spaces vs tabs)
- Consistent quote style (single vs double)
- Consistent semicolon usage
- Consistent import ordering
- Check with: `bash: "command": "prettier --check . || black --check ."`

### Phase 3: Dynamic Analysis

**3.1 Type Checking**
- Run TypeScript: `tsc --noEmit`
- Run mypy: `mypy .`
- Run Python type hints check

**3.2 Test Coverage**
- Check if tests exist for the changed files
- Run existing tests: `npm test`, `pytest`, `rspec`, etc.
- If coverage < 80%, flag as warning
- Use: `bash: "command": "npm test -- --coverage || pytest --cov=."`

**3.3 Manual Test Scenarios**
If automated tests are missing, create quick verification:
```bash
# Example for API endpoint
curl -X POST http://localhost:3000/api/endpoint -d '{"test": "data"}'

# Example for function
python3 -c "from module import func; print(func(test_input))"
```

### Phase 4: Performance Considerations

**4.1 Time Complexity**
- Identify O(n²) or worse algorithms
- Suggest optimizations (caching, memoization, better data structures)
- Flag nested loops over large datasets

**4.2 Memory Usage**
- Check for unnecessary object creation in loops
- Check for memory leaks (event listeners, subscriptions not cleaned up)
- Check for large data loads that could be paginated

**4.3 Database Optimization**
- N+1 query detection
- Missing indexes on query fields
- Unnecessary SELECT * queries
- Large transactions

## Review Output Format

Present findings in this order, grouped by severity:

### 🔴 Critical (Must Fix)
- [ ] Issue description
  - **Location**: file:line
  - **Impact**: What breaks or fails
  - **Fix**: Specific change needed

### 🟡 Warning (Should Fix)
- [ ] Issue description
  - **Location**: file:line
  - **Impact**: What could go wrong
  - **Fix**: Suggested improvement

### 🟢 Suggestion (Nice to Have)
- [ ] Issue description
  - **Location**: file:line
  - **Benefit**: Why this improves the code
  - **Fix**: Suggested change

## Language-Specific Guidelines

### JavaScript/TypeScript
- Use const over let when possible
- Prefer arrow functions for callbacks
- Use optional chaining (?.) and nullish coalescing (??)
- Avoid var
- Use === instead of ==
- Check for undefined before property access

### Python
- Use type hints for all functions
- Follow PEP 8 style guide
- Use context managers (with) for file operations
- Use f-strings over format() or %
- Use dataclasses for simple data containers
- Avoid mutable default arguments

### Java
- Follow Java naming conventions
- Use final for constants
- Prefer interfaces over abstract classes
- Use try-with-resources for AutoCloseable
- Consider using Lombok for boilerplate

### Go
- Follow Go naming conventions (camelCase, not snake_case)
- Handle errors explicitly (don't ignore return values)
- Use goroutines wisely (check for goroutine leaks)
- Prefer composition over inheritance

## Git Integration

Before considering code "done", verify:
1. All changes are staged: `git status`
2. Commit message follows convention (if applicable)
3. Run pre-commit hooks: `pre-commit run --all-files`
4. Check for accidental large files: `git check-file-size`

## Final Checklist Before "Done"

- [ ] All linting passes
- [ ] No syntax errors
- [ ] All tests pass
- [ ] Type checking passes (if applicable)
- [ ] No critical anti-patterns detected
- [ ] Code coverage is acceptable (>80%)
- [ ] No security vulnerabilities found
- [ ] Performance is acceptable (no O(n²) on large datasets)
- [ ] All new code has corresponding tests
- [ ] Documentation is updated (if applicable)

## Response Template

When providing review feedback, use this structure:

```
## Smart Code Review Results

**Status**: ✅ Ready / ⚠️ Needs Work / ❌ Blocked

### Summary
- Files reviewed: X
- Critical issues: Y
- Warnings: Z
- Suggestions: N

[Detailed findings by category]

### Next Steps
1. Fix critical issues (list them)
2. Address warnings (list them)
3. Consider suggestions (list them)
```

## Important Notes

1. **Don't be dogmatic** - These are guidelines, not absolute rules. Use judgment based on the project's context.

2. **Prioritize** - Focus on critical issues first. A single security vulnerability is more important than 10 style suggestions.

3. **Respect existing style** - If the project uses a different convention (e.g., snake_case in Python), follow it instead of your personal preference.

4. **Be efficient** - Don't run all checks if you can determine early that code won't pass. Run quick checks first.

5. **Communicate clearly** - Explain why something is a problem, not just that it is a problem.

6. **Use the tools** - Actually execute the commands (bash, grep, etc.) to verify findings rather than guessing.
