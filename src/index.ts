import { rateLimit, type RateLimitKeyFunc } from "@elithrar/workers-hono-rate-limit";
import { Hono, type MiddlewareHandler } from "hono";

type Bindings = Pick<Env, "ARTIFACTS" | "CREATE_RATE_LIMITER">;

const getCreateRateLimitKey: RateLimitKeyFunc = (c) => {
  return c.req.path;
};

const limitCreateRoute: MiddlewareHandler<{ Bindings: Bindings }> = (c, next) => {
  return rateLimit(c.env.CREATE_RATE_LIMITER, getCreateRateLimitKey)(c, next);
};

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

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.json({
    ok: true,
    routes: {
      create: "/repos/create?name=starter-repo",
      info: "/repos/info?name=starter-repo",
      token: "/repos/token?name=starter-repo&scope=read&ttl=3600",
    },
  });
});

app.get("/repos/create", limitCreateRoute, async (c) => {
  const name = c.req.query("name") ?? "starter-repo";

  try {
    const created = await c.env.ARTIFACTS.create(name, {
      description: "Repository for automation experiments",
      readOnly: false,
      setDefaultBranch: "main",
    });

    return c.json({
      name: created.name,
      remote: created.remote,
      token: created.token,
      expiresAt: created.expiresAt,
      defaultBranch: created.defaultBranch,
    });
  } catch {
    return c.json({ error: "duplicate" }, 409);
  }
});

app.get("/repos/info", async (c) => {
  const name = c.req.query("name") ?? "starter-repo";
  const repoState = getRepoHandle(await c.env.ARTIFACTS.get(name));

  if (repoState.kind === "not_found") {
    return c.json({ name, status: "not_found" }, 404);
  }

  if (repoState.kind === "pending") {
    return c.json(
      {
        name,
        status: repoState.status,
        retryAfter: repoState.retryAfter,
      },
      202,
    );
  }

  const info = await repoState.repo.info();
  return c.json({ status: "ready", info });
});

app.get("/repos/token", async (c) => {
  const name = c.req.query("name") ?? "starter-repo";
  const repoState = getRepoHandle(await c.env.ARTIFACTS.get(name));
  const scope = c.req.query("scope") === "read" ? "read" : "write";
  const ttl = Number(c.req.query("ttl") ?? "3600");

  if (repoState.kind === "not_found") {
    return c.json({ name, status: "not_found" }, 404);
  }

  if (repoState.kind === "pending") {
    return c.json(
      {
        name,
        status: repoState.status,
        retryAfter: repoState.retryAfter,
      },
      202,
    );
  }

  const token = await repoState.repo.createToken(scope, ttl);
  return c.json(token);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
