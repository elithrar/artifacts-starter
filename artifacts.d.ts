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
