param([ValidateSet('start','stop','status')][string]$Action='status')
$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$runtimePath=Join-Path $projectPath '.runtime'
$receiptPath=Join-Path $runtimePath 'services.json'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$nodePath=(Get-Command node.exe).Source
$records=@()
if(Test-Path -LiteralPath $receiptPath) {$records=@(Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json | ForEach-Object {foreach($entry in $_){$entry}})}
function Test-OwnedProcess($record) {
  if(-not $record){return $false}
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.id)" -ErrorAction SilentlyContinue
  if(-not $process){return $false}
  return $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($projectPath) -and $process.CommandLine.Contains($record.entry) -and ([datetime]$process.CreationDate).ToUniversalTime().ToString('o') -eq $record.created
}
function Stop-OwnedTree([int]$processId) {
  $children=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=$processId" -ErrorAction SilentlyContinue | Where-Object {$_.Name -eq 'node.exe' -and $_.CommandLine.Contains($projectPath)})
  Stop-Process -Id $processId -ErrorAction SilentlyContinue
  foreach($child in $children){Stop-OwnedTree $child.ProcessId}
}
if($Action -eq 'stop') {
  foreach($record in $records){if(Test-OwnedProcess $record){Stop-OwnedTree $record.id;Write-Output "Stopped $($record.name)"}}
  ConvertTo-Json -InputObject @() | Set-Content -LiteralPath $receiptPath -Encoding UTF8
  exit
}
if($Action -eq 'status') {
  foreach($record in $records){Write-Output "$($record.name): $(if(Test-OwnedProcess $record){'running'}else{'stopped'}) PID $($record.id)"}
  if($records.Count -eq 0){Write-Output 'No EM3 services started by this launcher.'}
  exit
}
if(-not(Test-Path -LiteralPath (Join-Path $projectPath 'backend/.env'))){throw 'Create backend/.env from .env.example and configure MySQL first. See README.md.'}
$definitions=@(
  @{name='backend';cwd='backend';entry='src/server.js';port=8001;args=@((Join-Path $projectPath 'backend/src/server.js'))},
  @{name='worker';cwd='backend';entry='src/worker.js';port=0;args=@((Join-Path $projectPath 'backend/src/worker.js'))},
  @{name='frontend';cwd='frontend';entry='next/dist/bin/next';port=3001;args=@((Join-Path $projectPath 'node_modules/next/dist/bin/next'),'dev','--hostname','localhost','--port','3001')}
)
foreach($service in $definitions){
  $existing=$records | Where-Object {$_.name -eq $service.name} | Select-Object -First 1
  if($service.port -gt 0 -and -not($existing -and (Test-OwnedProcess $existing)) -and (Get-NetTCPConnection -State Listen -LocalPort $service.port -ErrorAction SilentlyContinue)){throw "Port $($service.port) occupied. Refusing to start over another process."}
}
foreach($service in $definitions){
  $existing=$records | Where-Object {$_.name -eq $service.name} | Select-Object -First 1
  if($existing -and (Test-OwnedProcess $existing)){Write-Output "$($service.name) already running";continue}
  if($service.port -gt 0 -and (Get-NetTCPConnection -State Listen -LocalPort $service.port -ErrorAction SilentlyContinue)){throw "Port $($service.port) occupied. Refusing to stop another process."}
  $workingPath=Join-Path $projectPath $service.cwd
  $arguments=@($service.args | ForEach-Object {'"'+$_+'"'})
  $started=Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $workingPath -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 700
  $actual=Get-CimInstance Win32_Process -Filter "ProcessId=$($started.Id)" -ErrorAction SilentlyContinue
  if(-not $actual){throw "$($service.name) exited. Run npm run dev at the root for console diagnostics."}
  $record=[pscustomobject]@{name=$service.name;id=$started.Id;entry=[IO.Path]::GetFullPath($service.args[0]);created=([datetime]$actual.CreationDate).ToUniversalTime().ToString('o')}
  $records=@($records | Where-Object {$_.name -ne $service.name})+@($record)
  ConvertTo-Json -InputObject @($records) | Set-Content -LiteralPath $receiptPath -Encoding UTF8
  Write-Output "Started $($service.name) PID $($started.Id)"
}
Write-Output 'Web http://localhost:3001 ; Express http://localhost:8001 ; MySQL must already be running.'
