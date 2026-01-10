# JARVIS Sandbox Container
# Lightweight, secure execution environment for untrusted code

FROM node:22-alpine

# Install Python, common tools, and security utilities
RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    curl \
    git \
    jq \
    && ln -sf python3 /usr/bin/python

# Create non-root user for execution (use different GID to avoid conflicts)
RUN addgroup -g 2000 sandbox && \
    adduser -u 2000 -G sandbox -s /bin/bash -D sandbox

# Create workspace directory
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Set resource limits via ulimit defaults
# These can be overridden at container runtime
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER sandbox
WORKDIR /workspace

# Default command - keeps container running for exec
CMD ["tail", "-f", "/dev/null"]
