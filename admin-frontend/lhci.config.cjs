module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      staticDistDir: "./dist",
      url: ["http://127.0.0.1:4174/admin/login"]
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }]
      }
    }
  }
};
