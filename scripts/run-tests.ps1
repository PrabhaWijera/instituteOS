#!/usr/bin/env pwsh
<#
.SYNOPSIS
    NexClass full test suite runner

.DESCRIPTION
    Runs all test layers in order:
      1. Backend Unit Tests (Vitest)
      2. Backend Security Tests (Vitest)
      3. Frontend E2E Tests (Playwright) — skipped if no E2E credentials
      4. Load Tests (k6 via Docker) — opt-in with -LoadTest flag

.PARAMETER LoadTest
    Run k6 load test with 25 virtual users (requires Docker)

.PARAMETER UnitOnly
    Run only unit/security tests (fastest, no infra needed)

.PARAMETER E2EOnly
    Run only Playwright E2E tests

.EXAMPLE
    .\scripts\run-tests.ps1
    .\scripts\run-tests.ps1 -LoadTest
    .\scripts\run-tests.ps1 -UnitOnly
#>
param(
    [switch]$LoadTest,
    [switch]$UnitOnly,
    [switch]$E2EOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Write-Header($text) {
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Result($label, $success) {
    if ($success) {
        Write-Host "  ✓ $label" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $label" -ForegroundColor Red
    }
}

$results = @{}

# ── 1. Backend Unit + Security Tests ─────────────────────────────────────────
if (-not $E2EOnly) {
    Write-Header "Backend Unit & Security Tests (Vitest)"
    Push-Location "$root\backend"
    try {
        npm run test -- --reporter=verbose 2>&1
        $results["unit"] = ($LASTEXITCODE -eq 0)
    } catch {
        $results["unit"] = $false
    }
    Pop-Location
    Write-Result "Backend Unit Tests" $results["unit"]
}

# ── 2. Frontend E2E Tests ─────────────────────────────────────────────────────
if (-not $UnitOnly) {
    Write-Header "Frontend E2E Tests (Playwright)"

    # Check if any E2E credentials are set
    $hasE2ECreds = $env:E2E_TEST_EMAIL -or $env:E2E_ADMIN_EMAIL -or $env:E2E_STUDENT_EMAIL

    if (-not $hasE2ECreds) {
        Write-Host "  ⚠  No E2E credentials set — running auth/navigation tests only" -ForegroundColor Yellow
        Write-Host "     Set E2E_ADMIN_EMAIL, E2E_STUDENT_EMAIL, etc. to run full role tests" -ForegroundColor Yellow
    }

    Push-Location "$root\frontend"
    try {
        npx playwright test --reporter=list 2>&1
        $results["e2e"] = ($LASTEXITCODE -eq 0)
    } catch {
        $results["e2e"] = $false
    }
    Pop-Location
    Write-Result "Frontend E2E Tests" $results["e2e"]
}

# ── 3. k6 Load Test ───────────────────────────────────────────────────────────
if ($LoadTest) {
    Write-Header "Load Test — 25 Concurrent Users (k6 via Docker)"

    $baseUrl = $env:LOAD_TEST_BASE_URL
    if (-not $baseUrl) {
        $baseUrl = "http://host.docker.internal"
        Write-Host "  LOAD_TEST_BASE_URL not set — using $baseUrl" -ForegroundColor Yellow
    }

    # Build env flags for k6
    $k6Env = "-e BASE_URL=$baseUrl"

    # Pass through any account credentials if set
    1..10 | ForEach-Object {
        $email = [System.Environment]::GetEnvironmentVariable("STUDENT_EMAIL_$_")
        $pass  = [System.Environment]::GetEnvironmentVariable("STUDENT_PASSWORD_$_")
        if ($email) { $k6Env += " -e STUDENT_EMAIL_$_=$email" }
        if ($pass)  { $k6Env += " -e STUDENT_PASSWORD_$_=$pass" }
    }
    1..7 | ForEach-Object {
        $email = [System.Environment]::GetEnvironmentVariable("TEACHER_EMAIL_$_")
        $pass  = [System.Environment]::GetEnvironmentVariable("TEACHER_PASSWORD_$_")
        if ($email) { $k6Env += " -e TEACHER_EMAIL_$_=$email" }
        if ($pass)  { $k6Env += " -e TEACHER_PASSWORD_$_=$pass" }
    }

    $scriptPath = "$root\tests\load"

    try {
        $dockerCmd = "docker run --rm $k6Env " +
                     "-v `"${scriptPath}:/scripts`" " +
                     "grafana/k6 run /scripts/load-test.js"
        Write-Host "  Running: $dockerCmd" -ForegroundColor Gray
        Invoke-Expression $dockerCmd
        $results["load"] = ($LASTEXITCODE -eq 0)
    } catch {
        Write-Host "  Docker not available or k6 run failed: $_" -ForegroundColor Red
        $results["load"] = $false
    }
    Write-Result "Load Test (25 VUs × 3 min)" $results["load"]
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Header "Test Summary"
$allPassed = $true
foreach ($key in $results.Keys) {
    Write-Result $key $results[$key]
    if (-not $results[$key]) { $allPassed = $false }
}

if ($allPassed) {
    Write-Host ""
    Write-Host "  All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "  Some tests failed — check output above." -ForegroundColor Red
    exit 1
}
