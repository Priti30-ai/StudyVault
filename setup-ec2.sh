#!/usr/bin/env bash
# ==============================================================================
# StudyVault - EC2 Environment Verification & Setup Script
# Supports: Amazon Linux 2023 / Ubuntu 22.04+
# Target: StudyVault-Server (ap-southeast-2)
# ==============================================================================
set -euo pipefail

echo "======================================================"
echo "🚀 Verifying StudyVault EC2 Environment..."
echo "======================================================"

# 1. Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot determine OS."
    exit 1
fi

echo "ℹ️  Detected OS: $OS"

# 2. Check and install Docker if missing
if ! command -v docker &>/dev/null; then
    echo "📦 Docker not found. Installing..."
    if [ "$OS" = "amzn" ] || [ "$OS" = "fedora" ] || [ "$OS" = "rhel" ]; then
        sudo dnf update -y
        sudo dnf install -y docker git
    elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        sudo apt-get update -y
        sudo apt-get install -y ca-certificates curl gnupg git
        sudo install -m 0755 -d /etc/apt/keyrings
        sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        sudo chmod a+r /etc/apt/keyrings/docker.asc
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -y
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    fi
else
    echo "✅ Docker is already installed: $(docker --version)"
fi

# 3. Ensure Docker daemon is running
sudo systemctl enable --now docker
echo "✅ Docker service is active."

# 4. Add current user to docker group if needed
CURRENT_USER=$(whoami)
sudo usermod -aG docker "$CURRENT_USER" || true

# 5. Check Docker Compose (supports standalone docker-compose and docker compose plugin)
if command -v docker-compose &>/dev/null; then
    echo "✅ Standalone docker-compose found: $(docker-compose --version)"
elif docker compose version &>/dev/null; then
    echo "✅ Docker Compose plugin found: $(docker compose version)"
    # Create symlink so 'docker-compose' command works seamlessly
    if ! command -v docker-compose &>/dev/null; then
        echo "🔗 Aliasing docker-compose..."
        sudo ln -sf "$(command -v docker)" /usr/local/bin/docker-compose || true
    fi
else
    echo "📦 Installing standalone docker-compose..."
    COMPOSE_VERSION="v2.29.2"
    sudo curl -sSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Standalone docker-compose installed: $(docker-compose --version)"
fi

echo "======================================================"
echo "✅ EC2 Environment is ready!"
echo "Next step: Ensure backend/.env exists, then execute:"
echo "   docker-compose up -d --build"
echo "======================================================"
