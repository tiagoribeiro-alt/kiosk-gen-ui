#Requires -Version 5.1

param(
    [string]$EnvFile = ".env",
    [string]$ServiceName = "kiosk-gen-ui-backend",
    [string]$Region = "europe-west1",
    [string]$Repository = "kiosk-gen-ui",
    [string]$ImageTag = "",
    [int]$MinInstances = 0,
    [int]$MaxInstances = 2,
    [int]$Concurrency = 20,
    [int]$TimeoutSeconds = 300,
    [string]$Memory = "1Gi",
    [string]$Cpu = "1"
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

function Read-EnvFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Env file not found: $Path"
    }

    $values = @{}
    foreach ($rawLine in [System.IO.File]::ReadAllLines((Resolve-Path $Path))) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            continue
        }

        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $values[$key] = $value
    }

    return $values
}

function Get-GitSha {
    $sha = (& git rev-parse --short HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $sha) {
        return $sha.Trim()
    }

    return (Get-Date -Format "yyyyMMddHHmmss")
}

function Test-GcloudCommand {
    $command = Get-Command gcloud -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "gcloud is not installed or not available in PATH"
    }
}

function New-ArtifactRepositoryIfMissing {
    param(
        [Parameter(Mandatory)][string]$ProjectId,
        [Parameter(Mandatory)][string]$Region,
        [Parameter(Mandatory)][string]$Repository
    )

    & cmd /c "gcloud artifacts repositories describe $Repository --location $Region --project $ProjectId 1>nul 2>nul"
    if ($LASTEXITCODE -eq 0) {
        return
    }

    Write-Step "Creating Artifact Registry repository $Repository"
    & gcloud artifacts repositories create $Repository `
        --repository-format=docker `
        --location $Region `
        --project $ProjectId `
        --description "Docker images for kiosk-gen-ui"
}

Test-GcloudCommand

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $scriptDir $EnvFile
$envValues = Read-EnvFile -Path $envPath

foreach ($requiredKey in @('GEMINI_API_KEY', 'EVENTUAIS_BACKEND_URL', 'GCP_PROJECT_ID')) {
    if (-not $envValues.ContainsKey($requiredKey) -or [string]::IsNullOrWhiteSpace($envValues[$requiredKey])) {
        throw "Missing required env var '$requiredKey' in $EnvFile"
    }
}

$projectId = $envValues['GCP_PROJECT_ID']
$agentId = if ($envValues.ContainsKey('AGENT_ID') -and $envValues['AGENT_ID']) { $envValues['AGENT_ID'] } else { 'cim' }
$effectiveImageTag = if ($ImageTag) { $ImageTag } else { Get-GitSha }
$image = "${Region}-docker.pkg.dev/$projectId/$Repository/${ServiceName}:$effectiveImageTag"

Write-Step "Configuring gcloud project"
& gcloud config set project $projectId | Out-Null

Write-Step "Ensuring required APIs are enabled"
& gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $projectId

New-ArtifactRepositoryIfMissing -ProjectId $projectId -Region $Region -Repository $Repository

$envYaml = [System.IO.Path]::GetTempFileName()
try {
    $deployEnv = [ordered]@{
        GEMINI_API_KEY = $envValues['GEMINI_API_KEY']
        EVENTUAIS_BACKEND_URL = $envValues['EVENTUAIS_BACKEND_URL']
        AGENT_ID = $agentId
    }

    if ($envValues.ContainsKey('MODEL_NAME') -and $envValues['MODEL_NAME']) {
        $deployEnv['MODEL_NAME'] = $envValues['MODEL_NAME']
    }

    if ($envValues.ContainsKey('GREETING_AUDIO_PATH') -and $envValues['GREETING_AUDIO_PATH']) {
        $deployEnv['GREETING_AUDIO_PATH'] = $envValues['GREETING_AUDIO_PATH']
    }

    if ($envValues.ContainsKey('CORS_ORIGINS') -and $envValues['CORS_ORIGINS']) {
        $deployEnv['CORS_ORIGINS'] = $envValues['CORS_ORIGINS']
    }

    $yamlLines = foreach ($entry in $deployEnv.GetEnumerator()) {
        $escapedValue = $entry.Value.Replace("'", "''")
        "$($entry.Key): '$escapedValue'"
    }
    [System.IO.File]::WriteAllLines($envYaml, $yamlLines)

    Write-Step "Submitting backend image build"
    & gcloud builds submit $scriptDir --tag $image --project $projectId

    Write-Step "Deploying Cloud Run service"
    & gcloud run deploy $ServiceName `
        --image $image `
        --region $Region `
        --project $projectId `
        --platform managed `
        --allow-unauthenticated `
        --port 8080 `
        --cpu $Cpu `
        --memory $Memory `
        --concurrency $Concurrency `
        --min-instances $MinInstances `
        --max-instances $MaxInstances `
        --timeout $TimeoutSeconds `
        --env-vars-file $envYaml

    $serviceUrl = (& gcloud run services describe $ServiceName --region $Region --project $projectId --format "value(status.url)").Trim()
    Write-Step "Deployment complete"
    Write-Info "Service URL: $serviceUrl"
    Write-Info "Health check: $serviceUrl/health"
}
finally {
    if (Test-Path $envYaml) {
        Remove-Item $envYaml -Force
    }
}