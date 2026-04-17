import type { Service } from "cloudflare:workers";

interface ArtifactsRepoInfo {
  defaultBranch: string;
  remote: string;
}

interface ArtifactsCreateRepoResult {
  name: string;
  remote: string;
  token: string;
  expiresAt: string;
  defaultBranch: string;
}

interface ArtifactsCreateTokenResult {
  plaintext: string;
}

interface ArtifactsRepo {
  info(): Promise<ArtifactsRepoInfo | null>;
  createToken(
    scope?: "read" | "write",
    ttl?: number,
  ): Promise<ArtifactsCreateTokenResult>;
}

type ArtifactsGetRepoResult =
  | ArtifactsRepo
  | { status: "ready"; repo: ArtifactsRepo }
  | { status: "not_found" }
  | { status: "importing"; retryAfter: number }
  | { status: "forking"; retryAfter: number }
  | null;

interface Artifacts {
  create(
    name: string,
    opts?: {
      description?: string;
      readOnly?: boolean;
      setDefaultBranch?: string;
    },
  ): Promise<ArtifactsCreateRepoResult & { repo: ArtifactsRepo }>;
  get(name: string): Promise<ArtifactsGetRepoResult>;
}

interface Env {
  ARTIFACTS: Service<Artifacts>;
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function isRepoHandle(value: ArtifactsGetRepoResult): value is ArtifactsRepo {
  return !!value && typeof value === "object" && "info" in value;
}

function getRepoHandle(
  result: ArtifactsGetRepoResult,
):
  | { kind: "ready"; repo: ArtifactsRepo }
  | { kind: "not_found" }
  | { kind: "pending"; status: string; retryAfter?: number } {
  if (isRepoHandle(result)) {
    return { kind: "ready", repo: result };
  }

  if (!result) {
    return { kind: "not_found" };
  }

  if (result.status === "ready") {
    return { kind: "ready", repo: result.repo };
  }

  if (result.status === "not_found") {
    return { kind: "not_found" };
  }

  return {
    kind: "pending",
    status: result.status,
    retryAfter: result.retryAfter,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const name = url.searchParams.get("name") ?? "starter-repo";

    if (url.pathname === "/") {
      return json({
        ok: true,
        routes: {
          create: "/repos/create?name=starter-repo",
          info: "/repos/info?name=starter-repo",
          token: "/repos/token?name=starter-repo&scope=read&ttl=3600",
        },
      });
    }

    if (url.pathname === "/repos/create") {
      try {
        const created = await env.ARTIFACTS.create(name, {
          description: "Repository for automation experiments",
          readOnly: false,
          setDefaultBranch: "main",
        });
        return json({
          name: created.name,
          remote: created.remote,
          token: created.token,
          expiresAt: created.expiresAt,
          defaultBranch: created.defaultBranch,
        });
      } catch {
        return new Response("duplicate", { status: 409 });
      }
    }

    if (url.pathname === "/repos/info") {
      const repoState = getRepoHandle(await env.ARTIFACTS.get(name));

      if (repoState.kind === "not_found") {
        return json({ name, status: "not_found" }, { status: 404 });
      }

      if (repoState.kind === "pending") {
        return json(
          {
            name,
            status: repoState.status,
            retryAfter: repoState.retryAfter,
          },
          { status: 202 },
        );
      }

      const info = await repoState.repo.info();
      return json({ status: "ready", info });
    }

    if (url.pathname === "/repos/token") {
      const repoState = getRepoHandle(await env.ARTIFACTS.get(name));
      const scope = url.searchParams.get("scope") === "read" ? "read" : "write";
      const ttl = Number(url.searchParams.get("ttl") ?? "3600");

      if (repoState.kind === "not_found") {
        return json({ name, status: "not_found" }, { status: 404 });
      }

      if (repoState.kind === "pending") {
        return json(
          {
            name,
            status: repoState.status,
            retryAfter: repoState.retryAfter,
          },
          { status: 202 },
        );
      }

      const token = await repoState.repo.createToken(scope, ttl);
      return json(token);
    }

    return json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
