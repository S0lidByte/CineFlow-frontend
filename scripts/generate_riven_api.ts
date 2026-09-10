import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL;
const localSchemaPath = path.resolve(__dirname, "../../Triven_backend/openapi.json");

let schemaSource: string;

if (BACKEND_URL) {
    schemaSource = `"${BACKEND_URL}/openapi.json"`;
} else if (fs.existsSync(localSchemaPath)) {
    schemaSource = `"${localSchemaPath}"`;
    console.log(`BACKEND_URL not defined. Using local schema file: ${localSchemaPath}`);
} else {
    console.error("BACKEND_URL is not defined in .env and local openapi.json not found.");
    process.exit(1);
}

console.log("Generating Riven API client...");

try {
    execSync(`npx openapi-typescript ${schemaSource} -o src/lib/providers/riven.ts`, {
        stdio: "inherit"
    });
    console.log("Riven API client generated successfully.");
} catch (error) {
    console.error("Failed to generate Riven API client. Exiting...");
    console.error(error);
    process.exit(1);
}
