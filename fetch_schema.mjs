// Using native fetch in Node 18+

async function run() {
    try {
        const res = await fetch(
            "http://127.0.0.1:8080/api/v1/settings/schema/keys?keys=filesystem&title=Settings"
        );
        if (!res.ok) {
            console.error("API error", res.status);
            return;
        }
        const data = await res.json();
        console.log("SCHEMA DUMP (properties.filesystem):");
        console.log(JSON.stringify(data.properties?.filesystem, null, 2));

        console.log("\nSCHEMA DUMP ($defs.FilesystemModel):");
        console.log(JSON.stringify(data.$defs?.FilesystemModel, null, 2));

        console.log(
            "\nHas library_profiles in root properties?",
            !!data.properties?.filesystem?.properties?.library_profiles
        );
    } catch (e) {
        console.error("Fetch failed", e.message);
    }
}
run();
