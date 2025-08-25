/**
 * Semantic-release config for GitHub Packages publish.
 */
module.exports = {
  branches: ["main"],
  repositoryUrl: "https://github.com/Teejeeh/Angular-IndexedDB-ORM",
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "conventionalcommits",
      releaseRules: [
        { "type": "feat", "release": "minor" },
        { "type": "fix", "release": "patch" },
        { "type": "perf", "release": "patch" },
        { "type": "refactor", "release": "patch" },
        { "type": "build", "release": "patch" },
        { "type": "ci", "release": "patch" },
        { "type": "chore", "release": "patch" },
        { "type": "bump", "release": "patch" }
      ]
    }],
    ["@semantic-release/release-notes-generator", {
      preset: "conventionalcommits"
    }],
    ["@semantic-release/changelog", {
      changelogFile: "CHANGELOG.md"
    }],
    ["@semantic-release/npm", {
      npmPublish: true,
      pkgRoot: "dist"
    }],
    ["@semantic-release/github", {
      assets: []
    }],
    ["@semantic-release/git", {
      assets: ["CHANGELOG.md", "package.json"],
      message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
    }]
  ]
};
