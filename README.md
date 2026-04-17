# artifacts-starter

Quick demo of Cloudflare Artifacts ([docs](https://developers.cloudflare.com/artifacts/)).

Use the Wrangler preview build with Artifacts binding support:

```sh
npm exec --yes --package=https://pkg.pr.new/wrangler@13326 -- wrangler deploy
```

Use a unique repo name for `create`.

```sh
curl "https://artifacts-starter.silverlock.workers.dev/repos/create?name=my-artifacts-demo"
curl "https://artifacts-starter.silverlock.workers.dev/repos/info?name=my-artifacts-demo"
curl "https://artifacts-starter.silverlock.workers.dev/repos/token?name=my-artifacts-demo&scope=read&ttl=3600"
```
