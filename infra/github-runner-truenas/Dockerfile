ARG PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.61.1-noble@sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6
FROM ${PLAYWRIGHT_IMAGE}

ARG NODE_VERSION=22.23.1
ARG NODE_SHA256=9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578
ARG ACTIONS_RUNNER_VERSION=2.335.1
ARG ACTIONS_RUNNER_SHA256=4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        file \
        git \
        git-lfs \
        jq \
        procps \
        tar \
        unzip \
        util-linux \
        xz-utils \
    && git lfs install --system \
    && rm -rf /var/lib/apt/lists/*

RUN curl --fail --location --show-error --silent \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        --output /tmp/node.tar.xz \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check --strict \
    && tar --extract --xz --no-same-owner --file /tmp/node.tar.xz --directory /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && test "$(node --version)" = "v${NODE_VERSION}" \
    && npm --version

RUN uid_1000_user="$(getent passwd 1000 | cut -d: -f1)" \
    && test -n "$uid_1000_user" \
    && test "$(id -g "$uid_1000_user")" = "1000" \
    && if [ "$uid_1000_user" != "runner" ]; then \
        ! getent passwd runner >/dev/null \
        && usermod --login runner "$uid_1000_user"; \
    fi \
    && usermod --home /home/runner --move-home runner \
    && install -d -o 1000 -g 1000 -m 0755 /home/runner \
    && if getent passwd pwuser >/dev/null; then usermod --lock pwuser; fi \
    && test "$(id -u runner)" = "1000" \
    && test "$(id -g runner)" = "1000"

COPY actions-runner-linux-x64-2.335.1.tar.gz /tmp/actions-runner.tar.gz

RUN mkdir -p /opt/actions-runner-dist /opt/runner-hooks \
    && echo "${ACTIONS_RUNNER_SHA256}  /tmp/actions-runner.tar.gz" | sha256sum --check --strict \
    && tar --extract --gzip --no-same-owner --file /tmp/actions-runner.tar.gz --directory /opt/actions-runner-dist \
    && rm /tmp/actions-runner.tar.gz \
    && printf '%s\n' "${ACTIONS_RUNNER_VERSION}" > /opt/actions-runner-dist/.image-runner-version

RUN /opt/actions-runner-dist/bin/installdependencies.sh

COPY --chmod=0555 entrypoint.sh /usr/local/bin/runner-entrypoint
COPY --chmod=0555 cleanup-workspace.sh job-started.sh job-completed.sh /opt/runner-hooks/

RUN test "$(stat -c '%u:%g' /opt/actions-runner-dist)" = "0:0" \
    && test "$(stat -c '%u:%g' /opt/runner-hooks)" = "0:0" \
    && test "$(stat -c '%u:%g' /usr/local/bin/runner-entrypoint)" = "0:0" \
    && install -d -o 1000 -g 1000 -m 0700 /home/runner/.npm

LABEL org.opencontainers.image.title="Weltraum Browser GitHub Runner" \
      org.opencontainers.image.description="Repository-scoped GitHub Actions runner with Playwright Chromium" \
      org.opencontainers.image.source="https://github.com/BenjaminHornung/Weltraum-Spiel" \
      io.weltraum.playwright.version="1.61.1" \
      io.weltraum.actions-runner.version="2.335.1" \
      io.weltraum.node.version="22.23.1"

ENV HOME=/home/runner \
    CI=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    npm_config_cache=/home/runner/.npm \
    RUNNER_TOOL_CACHE=/runner-state/_tool

USER 1000:1000
WORKDIR /runner-state
ENTRYPOINT ["/usr/local/bin/runner-entrypoint"]
