import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "Polished";
export default defineRailway(() => {
  const Polished = service("Polished", {
    source: github("TrendTweekers/Polished", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "NIXPACKS" },
    start: "npm run start",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    preDeploy: "npx prisma migrate deploy",
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "polished" },
    // `railway config migrate` does not carry the restart policy across from
    // railway.json, so these two are set by hand to match what it had.
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 3 },
  });

  return project("polished", {
    variables: { managed: false },
    resources: [Polished],
  });
});
