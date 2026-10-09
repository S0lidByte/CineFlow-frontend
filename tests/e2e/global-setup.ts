import { execFileSync } from "node:child_process";

/** Fail closed before registering users or issuing probes against a local server. */
export default function globalSetup() {
    const containers = JSON.parse(
        execFileSync(
            "docker",
            [
                "inspect",
                "cineflow-e2e-frontend-1",
                "cineflow-e2e-backend-1",
                "cineflow-e2e-fixture-1"
            ],
            { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        )
    );
    for (const container of containers) {
        if (
            container.Config.Labels["com.docker.compose.project"] !== "cineflow-e2e" ||
            !container.State.Running
        ) {
            throw new Error("E2E requires the running disposable cineflow-e2e compose stack.");
        }
    }
    const [frontend, backend] = containers;
    const hasEnv = (container: { Config: { Env: string[] } }, value: string) =>
        container.Config.Env.includes(value);
    if (
        !hasEnv(frontend, "BACKEND_URL=http://backend:8080") ||
        !hasEnv(frontend, "AUTH_SECRET=e2e-disposable-auth-secret-not-for-production") ||
        !hasEnv(backend, "CINEFLOW_E2E_FIXTURES=true") ||
        !hasEnv(backend, "CINEFLOW_E2E_ALLDEBRID_ORIGIN=http://fixture:8765") ||
        !frontend.NetworkSettings.Ports["3000/tcp"]?.some(
            (binding: { HostIp: string; HostPort: string }) =>
                binding.HostIp === "127.0.0.1" && binding.HostPort === "3000"
        )
    ) {
        throw new Error("Refusing E2E execution: disposable fixture environment not verified.");
    }
}
