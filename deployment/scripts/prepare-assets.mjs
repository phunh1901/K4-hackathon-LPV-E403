import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const deploymentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(deploymentRoot, "..");
const publicRoot = resolve(deploymentRoot, "public");

await rm(publicRoot, { recursive: true, force: true });
await mkdir(resolve(publicRoot, "codebase"), { recursive: true });
await mkdir(resolve(publicRoot, "data/vlearn-pack/slides"), { recursive: true });
await mkdir(resolve(publicRoot, "logo"), { recursive: true });

for (const name of ["index.html", "app.js", "data.js", "styles.css"]) {
  await cp(
    resolve(repositoryRoot, "codebase", name),
    resolve(publicRoot, "codebase", name),
  );
}
await cp(
  resolve(repositoryRoot, "data/vlearn-pack/slides"),
  resolve(publicRoot, "data/vlearn-pack/slides"),
  { recursive: true },
);
await cp(
  resolve(repositoryRoot, "logo/vinuni-mark.png"),
  resolve(publicRoot, "logo/vinuni-mark.png"),
);

const socialCard = resolve(deploymentRoot, "assets/og.png");
await cp(socialCard, resolve(publicRoot, "og.png"));
