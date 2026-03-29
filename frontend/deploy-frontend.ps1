#Requires -Version 5.1

param(
    [string]$FirebaseProject = "eventuais-app-pt",

    [Parameter(Mandatory = $true)]
    [string]$BackendUrl,

    [string]$WebSocketUrl,
    [string]$PreviewChannelId = "kiosk-gen-ui-test",
    [switch]$Live,
    [switch]$SkipDeploy,
    [switch]$CleanInstall
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor Gray
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$CommandName)

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$CommandName is not installed or not available in PATH"
    }
}

function Test-FirebaseAccess {
    param([Parameter(Mandatory = $true)][string]$ProjectId)

    $output = & firebase use $ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        return
    }

    $message = ($output | Out-String).Trim()
    if ($message -match 'credentials are no longer valid' -or $message -match 'firebase login --reauth') {
        throw "Firebase CLI authentication expired. Run 'firebase login --reauth' and retry the deploy."
    }

    throw "Unable to access Firebase project '$ProjectId'. Firebase CLI output: $message"
}

$previousBackendUrl = $env:VITE_BACKEND_URL
$previousWebSocketUrl = $env:VITE_WS_URL

try {
    Write-Step "Checking prerequisites"
    Test-CommandAvailable -CommandName npm
    if (-not $SkipDeploy) {
        Test-CommandAvailable -CommandName firebase
        Write-Step "Validating Firebase CLI access"
        Test-FirebaseAccess -ProjectId $FirebaseProject
    }

    if ($CleanInstall) {
        Write-Step "Removing previous install artifacts"
        if (Test-Path "node_modules") {
            Remove-Item "node_modules" -Recurse -Force
        }
    }

    Write-Step "Installing frontend dependencies"
    & cmd /c "npm install"
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }

    $env:VITE_BACKEND_URL = $BackendUrl
    if ($WebSocketUrl) {
        $env:VITE_WS_URL = $WebSocketUrl
    }
    else {
        Remove-Item Env:VITE_WS_URL -ErrorAction SilentlyContinue
    }

    Write-Step "Running frontend test suite"
    & cmd /c "npm test -- --run"
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend tests failed"
    }

    Write-Step "Building frontend"
    if (Test-Path "dist") {
        Remove-Item "dist" -Recurse -Force
    }
    & cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed"
    }

    Write-Info "Firebase project: $FirebaseProject"
    Write-Info "Backend URL: $BackendUrl"
    if ($WebSocketUrl) {
        Write-Info "WebSocket URL: $WebSocketUrl"
    }

    if ($SkipDeploy) {
        Write-Step "Skipping Firebase deploy"
        return
    }

    if ($Live) {
        Write-Step "Deploying to live Firebase Hosting"
        & cmd /c "firebase deploy --project $FirebaseProject --only hosting"
        if ($LASTEXITCODE -ne 0) {
            throw "Firebase live deploy failed"
        }
        return
    }

    Write-Step "Deploying to Firebase Hosting preview channel"
    & cmd /c "firebase hosting:channel:deploy $PreviewChannelId --project $FirebaseProject"
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase preview deploy failed"
    }
}
finally {
    $env:VITE_BACKEND_URL = $previousBackendUrl
    $env:VITE_WS_URL = $previousWebSocketUrl
}