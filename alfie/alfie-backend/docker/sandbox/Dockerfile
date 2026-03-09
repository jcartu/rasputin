FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir numpy pandas matplotlib requests beautifulsoup4

RUN getent passwd 65534 || useradd -r -u 65534 sandbox
USER sandbox
WORKDIR /sandbox
