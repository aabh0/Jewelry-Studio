import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jewelry-studio-test-"));
process.env.DATA_DIR = tmp;
process.env.DB_PATH = path.join(tmp, "studio.sqlite");
process.env.MOCK_PROVIDERS = "1";
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
