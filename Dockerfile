# A harness in a container.
#
# Read this before you deploy it. Three things about a deployed harness are
# different from the one on your laptop, and all three are decisions:
#
#   1. Nobody is watching. The CLI adapter reads stdin, so it needs `-it`. A
#      harness meant to run unattended needs a real messaging adapter first.
#   2. Nobody can approve. Guardrails that require approval fail closed with no
#      human present, so those tool calls will be denied, not queued.
#   3. The filesystem is ephemeral. Memory and reflection proposals go to /data,
#      which must be a volume, or the harness forgets everything on restart.

FROM node:24-slim

# The bash tool shells out. git and CA certs are the floor for most harnesses;
# add what yours actually needs and nothing more. Every binary here is a binary
# your model can run.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so editing a prompt does not reinstall the tree.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# pi writes sessions, settings and credentials under its agent dir. The default
# is ~/.pi/agent, which a non-root user cannot create at runtime, so name it.
ENV PI_CODING_AGENT_DIR=/app/.pi/agent \
    HARNESS_MEMORY_DIR=/data/memory \
    HARNESS_PROPOSALS_DIR=/data/proposals \
    NODE_ENV=production

# Not root. The harness runs shell commands the model chose; a container is a
# better place for that than your laptop, but only if it is not privileged.
RUN useradd --create-home --uid 10001 harness \
 && mkdir -p /app/.pi/agent /data/memory /data/proposals \
 && chown -R harness:harness /app /data
USER harness

VOLUME ["/data"]

CMD ["npm", "start"]
