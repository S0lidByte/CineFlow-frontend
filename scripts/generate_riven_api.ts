import { execSync } from "child_process";
import * as fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL;
const localSchemaPath = path.resolve(scriptDirectory, "../../Triven_backend/openapi.json");

let schemaSource: string;

if (BACKEND_URL) {
    schemaSource = new URL("openapi.json", `${BACKEND_URL.replace(/\/$/, "")}/`).href;
} else if (fs.existsSync(localSchemaPath)) {
    schemaSource = localSchemaPath;
    console.log(`BACKEND_URL not defined. Using local schema file: ${localSchemaPath}`);
} else {
    console.error("BACKEND_URL is not defined in .env and local openapi.json not found.");
    process.exit(1);
}

console.log("Generating Riven API client...");

try {
    const quotedSchemaSource = JSON.stringify(schemaSource);
    execSync(`npx openapi-typescript ${quotedSchemaSource} -o src/lib/providers/riven.ts`, {
        stdio: "inherit"
    });
    execSync("npx prettier --write src/lib/providers/riven.ts", { stdio: "inherit" });
    console.log("Riven API client generated successfully.");
} catch (error) {
    console.error("Failed to generate Riven API client. Exiting...");
    console.error(error);
    process.exit(1);
}
