#!/bin/bash
# ==========================================================================
# RASPUTIN Server Setup Script
# For Arch Linux with RTX 6000 Pro Blackwell GPU
# ==========================================================================

set -e

echo "=========================================="
echo "RASPUTIN Server Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==========================================================================
# 1. System Updates
# ==========================================================================
log_info "Updating system packages..."
sudo pacman -Syu --noconfirm

# ==========================================================================
# 2. Install Required Packages
# ==========================================================================
log_info "Installing required packages..."
sudo pacman -S --noconfirm --needed \
    docker \
    docker-compose \
    nvidia-container-toolkit \
    git \
    curl \
    wget \
    htop \
    nvtop \
    tmux

# ==========================================================================
# 3. Configure Docker
# ==========================================================================
log_info "Configuring Docker..."

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group
sudo usermod -aG docker $USER

# Configure NVIDIA Container Toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# ==========================================================================
# 4. Verify GPU Access
# ==========================================================================
log_info "Verifying GPU access in Docker..."
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

if [ $? -eq 0 ]; then
    log_info "GPU access verified successfully!"
else
    log_error "GPU access failed. Please check NVIDIA drivers and container toolkit."
    exit 1
fi

# ==========================================================================
# 5. Create Directory Structure
# ==========================================================================
log_info "Creating directory structure..."
mkdir -p ~/rasputin/{data,logs,models,backups}

# ==========================================================================
# 6. Pull Required Docker Images
# ==========================================================================
log_info "Pulling Docker images..."
docker pull ollama/ollama:latest
docker pull caddy:2-alpine
docker pull node:22-alpine

# ==========================================================================
# 7. Setup Ollama
# ==========================================================================
log_info "Setting up Ollama..."

# Start Ollama temporarily to pull models
docker run -d --name ollama-setup \
    --gpus all \
    -v ollama-models:/root/.ollama \
    ollama/ollama:latest

# Wait for Ollama to start
sleep 10

# Pull recommended models
log_info "Pulling recommended models (this may take a while)..."

# Primary reasoning model
docker exec ollama-setup ollama pull llama3.3:70b-instruct-q4_K_M || \
    log_warn "Failed to pull llama3.3:70b, trying smaller variant..."
docker exec ollama-setup ollama pull llama3.2:latest

# Code specialist
docker exec ollama-setup ollama pull deepseek-coder-v2:16b || \
    docker exec ollama-setup ollama pull codellama:13b

# Fast model for quick tasks
docker exec ollama-setup ollama pull mistral:7b

# Embedding model
docker exec ollama-setup ollama pull nomic-embed-text:latest

# Stop and remove setup container
docker stop ollama-setup
docker rm ollama-setup

log_info "Models pulled successfully!"

# ==========================================================================
# 8. Create Environment File
# ==========================================================================
log_info "Creating environment file template..."
cat > ~/rasputin/.env.template << 'EOF'
# RASPUTIN Environment Configuration
# Copy this to .env and fill in your values

# Database
DATABASE_URL=mysql://user:password@host:3306/rasputin

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this

# Cloud API Keys (for fallback)
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=
SONAR_API_KEY=
ELEVENLABS_API_KEY=
CEREBRAS_API_KEY=

# Local LLM Configuration
LOCAL_LLM_ENABLED=true
OLLAMA_URL=http://localhost:11434
VLLM_URL=http://localhost:8000
LOCAL_LLM_PRIORITY=local

# Domain (for Caddy SSL)
DOMAIN=rasputin.yourdomain.com
EOF

log_info "Environment template created at ~/rasputin/.env.template"

# ==========================================================================
# 9. Create Systemd Service
# ==========================================================================
log_info "Creating systemd service..."
sudo tee /etc/systemd/system/rasputin.service > /dev/null << 'EOF'
[Unit]
Description=RASPUTIN AI System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/josh/rasputin
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=josh
Group=docker

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable rasputin.service

# ==========================================================================
# 10. Setup Monitoring
# ==========================================================================
log_info "Setting up monitoring..."

# Create monitoring script
cat > ~/rasputin/monitor.sh << 'EOF'
#!/bin/bash
# RASPUTIN Monitoring Script

echo "=== GPU Status ==="
nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv

echo ""
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Ollama Models ==="
curl -s http://localhost:11434/api/tags | jq -r '.models[] | "\(.name) - \(.size | . / 1073741824 | floor)GB"' 2>/dev/null || echo "Ollama not running"

echo ""
echo "=== System Resources ==="
free -h
df -h /
EOF
chmod +x ~/rasputin/monitor.sh

# ==========================================================================
# 11. Final Instructions
# ==========================================================================
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
log_info "Next steps:"
echo "1. Copy .env.template to .env and fill in your values:"
echo "   cp ~/rasputin/.env.template ~/rasputin/.env"
echo "   nano ~/rasputin/.env"
echo ""
echo "2. Clone the RASPUTIN repository:"
echo "   cd ~/rasputin && git clone <your-repo-url> app"
echo ""
echo "3. Start the services:"
echo "   cd ~/rasputin/app/deploy && docker compose up -d"
echo ""
echo "4. Monitor the system:"
echo "   ~/rasputin/monitor.sh"
echo ""
echo "5. View logs:"
echo "   docker compose logs -f"
echo ""
log_warn "Remember to log out and back in for docker group changes to take effect!"
