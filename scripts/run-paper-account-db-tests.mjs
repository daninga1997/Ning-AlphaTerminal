import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const rawPatterns = process.argv.slice(2);
const patterns = rawPatterns.filter((pattern) => pattern.trim().length > 0);

if (patterns.length === 0) {
  console.error("PAPER_ACCOUNT_TEST_PATTERN_REQUIRED");
  process.exitCode = 1;
} else {
  const prismaCliPath = await resolveLocalCli("prisma", "prisma");
  const vitestCliPath = await resolveLocalCli("vitest", "vitest");
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "ning-paper-account-db-"),
  );
  const databasePath = path.join(tempDirectory, "paper-account-test.db");
  const normalizedDatabasePath = databasePath.replaceAll("\\", "/");
  const databaseUrl = `file:${normalizedDatabasePath}`;
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  try {
    await writeFile(databasePath, "");
    await runNodeCli(
      prismaCliPath,
      ["generate", "--schema", "prisma/schema.prisma"],
      environment,
      "prisma-generate",
    );
    await runNodeCli(
      prismaCliPath,
      ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
      environment,
      "prisma-migrate-deploy",
    );
    await runNodeCli(vitestCliPath, ["run", ...patterns], environment, "vitest-run");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function resolveLocalCli(packageName, binName) {
  let packageJsonPath;
  let packageJson;

  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`);
    packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  } catch {
    throw new Error(`PAPER_ACCOUNT_CLI_PACKAGE_INVALID:${packageName}`);
  }

  const relativeBinPath =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : packageJson.bin?.[binName];

  if (typeof relativeBinPath !== "string" || relativeBinPath.length === 0) {
    throw new Error(`PAPER_ACCOUNT_CLI_BIN_NOT_FOUND:${packageName}:${binName}`);
  }

  const cliPath = path.resolve(path.dirname(packageJsonPath), relativeBinPath);

  try {
    await access(cliPath);
  } catch {
    throw new Error(`PAPER_ACCOUNT_CLI_BIN_NOT_FOUND:${packageName}:${binName}`);
  }

  return cliPath;
}

function runNodeCli(cliPath, args, env, stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: "inherit",
      env,
      shell: false,
    });

    child.once("error", (error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      reject(
        new Error(
          `PAPER_ACCOUNT_DB_TEST_COMMAND_FAILED:${stage}:null:none:${errorMessage}`,
        ),
      );
    });
    child.once("close", (code, signal) => {
      if (code === 0 && signal === null) {
        resolve();
        return;
      }

      reject(
        new Error(
          `PAPER_ACCOUNT_DB_TEST_COMMAND_FAILED:${stage}:${code ?? "null"}:${signal ?? "none"}`,
        ),
      );
    });
  });
}
