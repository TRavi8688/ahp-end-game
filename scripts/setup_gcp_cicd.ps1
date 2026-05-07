$ErrorActionPreference = "Continue"
$Project = "ahp2o-495503"
$Gcloud = "C:\Users\DELL\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$ProjectNum = & $Gcloud projects describe $Project --format="value(projectNumber)"
$Repo = "TRavi8688/ahp-end-game"
$Pool = "github-pool"
$Provider = "github-provider"
$SA_Name = "github-deployer"
$SA_Email = "$SA_Name@$Project.iam.gserviceaccount.com"

Write-Host "=========================================="
Write-Host "Starting GCP Workload Identity Setup"
Write-Host "=========================================="

Write-Host "[1/5] Enabling CI/CD APIs..."
& $Gcloud services enable iamcredentials.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com run.googleapis.com cloudresourcemanager.googleapis.com firebase.googleapis.com

Write-Host "[2/5] Creating Workload Identity Pool..."
$poolExists = & $Gcloud iam workload-identity-pools list --location="global" --filter="name:$Pool" --format="value(name)"
if (-not $poolExists) {
    & $Gcloud iam workload-identity-pools create $Pool --location="global" --display-name="GitHub Actions Pool"
}

Write-Host "[3/5] Creating OIDC Provider for GitHub..."
$providerExists = & $Gcloud iam workload-identity-pools providers list --workload-identity-pool=$Pool --location="global" --filter="name:$Provider" --format="value(name)"
if (-not $providerExists) {
    & $Gcloud iam workload-identity-pools providers create-oidc $Provider --location="global" --workload-identity-pool=$Pool --display-name="GitHub Actions Provider" --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" --attribute-condition="assertion.repository == '$Repo'" --issuer-uri="https://token.actions.githubusercontent.com"
}

Write-Host "[4/5] Creating Service Account ($SA_Name)..."
$saExists = & $Gcloud iam service-accounts list --filter="email:$SA_Email" --format="value(email)"
if (-not $saExists) {
    & $Gcloud iam service-accounts create $SA_Name --display-name="GitHub Actions Deployer"
}

Write-Host "Granting Deployment Roles..."
$roles = @("roles/run.admin", "roles/artifactregistry.repoAdmin", "roles/iam.serviceAccountUser", "roles/storage.admin", "roles/secretmanager.admin", "roles/firebase.admin")
foreach ($role in $roles) {
    & $Gcloud projects add-iam-policy-binding $Project --member="serviceAccount:$SA_Email" --role=$role --condition=None
}

Write-Host "[5/5] Binding GitHub Repo to Service Account..."
& $Gcloud iam service-accounts add-iam-policy-binding $SA_Email --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/$ProjectNum/locations/global/workloadIdentityPools/$Pool/attribute.repository/$Repo"

Write-Host "=========================================="
Write-Host "Workload Identity Setup Complete!"
Write-Host "=========================================="
Write-Host "YOUR GCP_WORKLOAD_IDENTITY_PROVIDER STRING IS:"
Write-Host "projects/$ProjectNum/locations/global/workloadIdentityPools/$Pool/providers/$Provider"
Write-Host "=========================================="
