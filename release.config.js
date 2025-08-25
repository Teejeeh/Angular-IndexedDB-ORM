/**
 * Semantic-release config for GitHub Packages publish.
 */
module.exports = {
  branches: ["main"],
  repositoryUrl: "https://github.com/Teejeeh/Angular-IndexedDB-ORM",
  plugins: [
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
