import nextConfig from "eslint-config-next/core-web-vitals"

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/", "node_modules/", "output/", "public/", "externals/", "*.min.js", "onload.js"],
  },
]

export default eslintConfig
