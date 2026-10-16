// Run tests in the time zone the scrape workflows use. Set here, before Jest
// spawns its workers: a test file's process.env is a sandboxed copy, so
// assigning TZ inside a test never reaches the date code.
process.env.TZ = "Asia/Jerusalem";

/** @type {import('jest').Config} */
export default {
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
          },
          target: "es2022",
        },
        module: {
          type: "commonjs",
        },
      },
    ],
  },
  testEnvironment: "node",
  rootDir: "./src",
  moduleNameMapper: {
    "^(\\.\\.?\\/.+)\\.jsx?$": "$1",
  },
  reporters: ["default", ["github-actions", { silent: false }], "summary"],
};
