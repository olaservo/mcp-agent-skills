#
# MCP Server TypeScript - Add Snippet
#
# Usage:
#   .\add.ps1 <snippet-name>              # Copy snippet to ./src
#   .\add.ps1 <snippet-name> -Dest ./lib  # Copy to custom directory
#   .\add.ps1 --list                      # Show available snippets
#   .\add.ps1 -Update                     # Refresh snippets from GitHub
#

param(
    [Parameter(Position=0)]
    [string]$Snippet,
    [Alias("Dest")]
    [string]$Destination = ".\src",
    [switch]$Update,
    [switch]$List
)

$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$SnippetsDir = Join-Path $SkillDir "snippets"
$ManifestFile = Join-Path $SkillDir "manifest.json"

# Check manifest exists
if (-not (Test-Path $ManifestFile)) {
    Write-Host "Error: manifest.json not found at $ManifestFile" -ForegroundColor Red
    exit 1
}

# Read manifest
$Manifest = Get-Content $ManifestFile | ConvertFrom-Json

# Function to update snippets from GitHub
function Update-Snippets {
    Write-Host "Updating snippets from GitHub..." -ForegroundColor Blue

    $RemoteBaseUrl = $Manifest.remoteBaseUrl
    $RepoUrl = $Manifest.repoUrl

    foreach ($snippetName in $Manifest.snippets.PSObject.Properties.Name) {
        $snippet = $Manifest.snippets.$snippetName
        $localFile = $snippet.localFile
        $remoteFiles = $snippet.remoteFiles

        $destPath = Join-Path $SnippetsDir $localFile
        $destDir = Split-Path -Parent $destPath

        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Use first remote file as source
        $firstRemote = $remoteFiles[0]
        $rawUrl = "$RemoteBaseUrl/$firstRemote"
        $sourceUrl = "$RepoUrl/$firstRemote"

        Write-Host "  Fetching: " -NoNewline
        Write-Host $snippetName -ForegroundColor Yellow

        try {
            $content = Invoke-RestMethod -Uri $rawUrl -UseBasicParsing

            if (-not $content) {
                Write-Host "  Error: Failed to fetch $firstRemote" -ForegroundColor Red
                continue
            }

            # Create header comment
            $header = @"
/**
 * Source: $sourceUrl
 *
 * This snippet was fetched from the MCP Everything reference server.
 * Customize as needed for your use case.
 */

"@
            "$header$content" | Out-File -FilePath $destPath -Encoding UTF8
            Write-Host "  Updated: " -NoNewline -ForegroundColor Green
            Write-Host $localFile
        }
        catch {
            Write-Host "  Error fetching $firstRemote : $_" -ForegroundColor Red
        }
    }

    Write-Host "Snippets updated!" -ForegroundColor Green
}

# Function to list available snippets
function Show-Snippets {
    Write-Host ""
    Write-Host "Available snippets:" -ForegroundColor Green
    Write-Host ""

    foreach ($prop in $Manifest.snippets.PSObject.Properties) {
        $name = $prop.Name
        $desc = $prop.Value.description
        $category = $prop.Value.category

        Write-Host "  $name" -ForegroundColor Yellow -NoNewline
        Write-Host " [$category]" -ForegroundColor Blue
        Write-Host "      $desc"
        Write-Host ""
    }

    Write-Host "Usage: .\add.ps1 <snippet-name> [-Dest <directory>]" -ForegroundColor Cyan
}

# Handle --list flag
if ($List) {
    Show-Snippets
    exit 0
}

# Handle -Update flag
if ($Update) {
    Update-Snippets
    exit 0
}

# Require snippet name
if (-not $Snippet) {
    Write-Host "Error: Snippet name required" -ForegroundColor Red
    Write-Host ""
    Show-Snippets
    exit 1
}

# Validate snippet exists
$SnippetData = $Manifest.snippets.$Snippet
if (-not $SnippetData) {
    Write-Host "Error: Unknown snippet '$Snippet'" -ForegroundColor Red
    Write-Host ""
    Show-Snippets
    exit 1
}

# Get local file path
$LocalFile = $SnippetData.localFile
$SourcePath = Join-Path $SnippetsDir $LocalFile

if (-not (Test-Path $SourcePath)) {
    Write-Host "Error: Snippet file not found at $SourcePath" -ForegroundColor Red
    Write-Host "Run with -Update to fetch snippets from GitHub"
    exit 1
}

# Create destination if it doesn't exist
if (-not (Test-Path $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

# Get just the filename
$filename = Split-Path -Leaf $LocalFile
$destPath = Join-Path $Destination $filename

# Copy the file
Copy-Item -Path $SourcePath -Destination $destPath -Force
Write-Host "Copied: " -NoNewline -ForegroundColor Green
Write-Host "$Snippet -> $destPath"
