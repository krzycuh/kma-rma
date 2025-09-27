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

function show_help
    echo "Usage: ./copy-and-load-to-rpi.fish <target>"
    echo "Example: ./copy-and-load-to-rpi.fish pi@raspberrypi.local"
end

if test (count $argv) -lt 1
    show_help
    exit 1
end

set SSH_TARGET $argv[1]
set TARGET_DIR "target/"
set RPI_DIR "docker-compose/"
set FILE_NAME "kma-rma-arm.tar"

log_step "Check local file $TARGET_DIR$FILE_NAME"
if not test -f $TARGET_DIR$FILE_NAME
    log_error "File not found: $TARGET_DIR$FILE_NAME"
    exit 1
end

log_step "Copy file to RPi: ~/$RPI_DIR"
scp $TARGET_DIR$FILE_NAME $SSH_TARGET:~/$RPI_DIR

log_step "Load image and remove tar on RPi"
ssh $SSH_TARGET "docker load -i ~/$RPI_DIR$FILE_NAME && rm ~/$RPI_DIR$FILE_NAME"

log_step "Restart container with new image"
ssh $SSH_TARGET "cd ~/$RPI_DIR && docker compose up -d --force-recreate kma-rma"

log_success "Deployed successfully"


