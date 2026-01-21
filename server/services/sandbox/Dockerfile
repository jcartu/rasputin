# JARVIS Sandbox Container
# Lightweight, secure execution environment for untrusted code

FROM node:22-alpine

# Install Python, common tools, build deps, and security utilities
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    py3-requests \
    py3-numpy \
    py3-matplotlib \
    py3-pillow \
    py3-pandas \
    py3-scipy \
    py3-scikit-learn \
    bash \
    curl \
    git \
    jq \
    gcc \
    g++ \
    musl-dev \
    linux-headers \
    freetype-dev \
    libpng-dev \
    && ln -sf python3 /usr/bin/python \
    && pip install --break-system-packages \
        yfinance \
        plotly \
        seaborn \
        altair \
        bokeh \
        networkx \
        wordcloud \
        statsmodels \
        fredapi \
        alpha_vantage \
        kaleido \
    && apk del gcc g++ musl-dev linux-headers python3-dev

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
