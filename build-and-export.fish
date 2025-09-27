#!/usr/bin/env fish

function log_step
    echo -e "\033[1;34m[STEP]\033[0m $argv"
end

function log_success
    echo -e "\033[1;32m[SUCCESS]\033[0m $argv"
end

function log_error
    echo -e "\033[1;31m[ERROR]\033[0m $argv"
end

function run_command
    set cmd $argv
    log_step "Running: $cmd"
    eval $cmd
    if test $status -ne 0
        log_error "Command failed: $cmd"
        exit 1
    end
end

echo "=== Building and exporting Docker image (ARM64) ==="

set SCRIPT_DIR (dirname (status -f))
cd $SCRIPT_DIR

set IMAGE_NAME "kma-rma:latest"
set EXPORT_FILE "target/kma-rma-arm.tar"

mkdir -p target

log_step "Configure Docker buildx"
docker buildx create --use 2>/dev/null

log_step "Build image for linux/arm64"
run_command "docker buildx build --platform linux/arm64 -t $IMAGE_NAME --load --no-cache ."

log_step "Export image to $EXPORT_FILE"
run_command "docker save -o $EXPORT_FILE $IMAGE_NAME"

log_success "Image saved to $EXPORT_FILE"


