$ErrorActionPreference = "Continue"
$Project = "ahp2o-495503"
$Region = "us-central1"
$Vpc = "ahp-vpc"

$Gcloud = "C:\Users\DELL\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

Write-Host "=========================================="
Write-Host "🚀 Starting AHP 2.0 GCP Provisioning"
Write-Host "=========================================="

Write-Host "`n[1/5] Setting Project Context..."
& $Gcloud config set project $Project

Write-Host "`n[2/5] Enabling GCP APIs (SQL, Redis, Compute)..."
& $Gcloud services enable compute.googleapis.com sqladmin.googleapis.com redis.googleapis.com servicenetworking.googleapis.com vpcaccess.googleapis.com

Write-Host "`n[3/5] Setting up Networking (VPC & Subnets)..."
$vpcExists = & $Gcloud compute networks list --filter="name=$Vpc" --format="value(name)"
if (-not $vpcExists) {
    Write-Host "Creating VPC..."
    & $Gcloud compute networks create $Vpc --subnet-mode=custom
} else {
    Write-Host "VPC already exists. Skipping."
}

$subnetExists = & $Gcloud compute networks subnets list --filter="name=ahp-subnet" --format="value(name)"
if (-not $subnetExists) {
    Write-Host "Creating Subnet..."
    & $Gcloud compute networks subnets create ahp-subnet --network=$Vpc --region=$Region --range=10.0.0.0/24
} else {
    Write-Host "Subnet already exists. Skipping."
}

Write-Host "Configuring Private Services Access..."
$addrExists = & $Gcloud compute addresses list --global --filter="name=google-managed-services-ahp-vpc" --format="value(name)"
if (-not $addrExists) {
    & $Gcloud compute addresses create google-managed-services-ahp-vpc --global --purpose=VPC_PEERING --prefix-length=16 --network=$Vpc
    & $Gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges=google-managed-services-ahp-vpc --network=$Vpc --project=$Project
}

Write-Host "`n[4/5] Provisioning Database (Cloud SQL Multi-AZ)..."
Write-Host "⏳ Note: This step takes 10-15 minutes. Please be patient."
$sqlExists = & $Gcloud sql instances list --filter="name=ahp-db" --format="value(name)"
if (-not $sqlExists) {
    & $Gcloud sql instances create ahp-db --database-version=POSTGRES_15 --region=$Region --network=$Vpc --no-assign-ip --tier=db-custom-1-3840 --availability-type=REGIONAL
} else {
    Write-Host "Cloud SQL instance already exists. Skipping."
}

Write-Host "Setting secure DB password..."
& $Gcloud sql users set-password postgres --instance=ahp-db --password="AHP_Super_Secret_Password_123!"

Write-Host "`n[5/5] Provisioning Cache (Cloud Memorystore Redis HA)..."
Write-Host "⏳ Note: This step takes 5-10 minutes."
$redisExists = & $Gcloud redis instances list --region=$Region --filter="name=ahp-redis" --format="value(name)"
if (-not $redisExists) {
    & $Gcloud redis instances create ahp-redis --size=1 --region=$Region --network=$Vpc --tier=STANDARD_HA
} else {
    Write-Host "Redis instance already exists. Skipping."
}

Write-Host "`n=========================================="
Write-Host "✅ Deployment Complete! The Data Layer is live."
Write-Host "=========================================="
