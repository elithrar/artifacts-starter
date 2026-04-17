# artifacts-starter

Quick demo of Cloudflare Artifacts ([docs](https://developers.cloudflare.com/artifacts/)).

Use the Wrangler preview build with Artifacts binding support:

```sh
npm exec --yes --package=https://pkg.pr.new/wrangler@13326 -- wrangler deploy
```

Minimal end-to-end flow:

```sh
export WORKER_URL="https://artifacts-starter.silverlock.workers.dev"
export REPO_NAME="artifacts-demo-$(date +%s)"

CREATE_RESPONSE=$(curl --silent --show-error \
  "$WORKER_URL/repos/create?name=$REPO_NAME")

export ARTIFACTS_REMOTE=$(printf '%s' "$CREATE_RESPONSE" | jq -r '.remote')
export ARTIFACTS_TOKEN=$(printf '%s' "$CREATE_RESPONSE" | jq -r '.token')

git -c http.extraHeader="Authorization: Bearer $ARTIFACTS_TOKEN" \
  clone "$ARTIFACTS_REMOTE" "/tmp/$REPO_NAME"

curl "$WORKER_URL/repos/info?name=$REPO_NAME"
curl "$WORKER_URL/repos/token?name=$REPO_NAME&scope=read&ttl=3600"
```
