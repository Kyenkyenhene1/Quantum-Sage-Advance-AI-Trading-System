# Script to create a branch with current changes and push to origin to trigger CI
# Usage: From repo root, run:
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-trigger-ci.ps1 -BranchName "ci/update-all"
param(
  [string]$BranchName = "ci/update-all"
)

# Ensure git is available
try { Get-Command git -ErrorAction Stop | Out-Null } catch { Write-Error "git not found in PATH"; exit 2 }

Write-Host "Creating branch $BranchName and pushing to origin..."

git checkout -b $BranchName
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create branch"; exit $LASTEXITCODE }

git commit -m "chore: apply infra & CI improvements (env validation, Docker, workflows)" || Write-Host "No changes to commit"
git add -A
git commit -m "chore: apply infra & CI improvements (env validation, Docker, workflows)"
if ($LASTEXITCODE -ne 0) { Write-Host "No changes to commit" }

git push --set-upstream origin $BranchName
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to push branch"; exit $LASTEXITCODE }

Write-Host "Branch pushed. CI should trigger on GitHub. Open a PR from $BranchName to main when ready."
