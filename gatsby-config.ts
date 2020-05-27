export const siteMetadata = {
  title: "Geoffrey Challen: Hacker, Professor",
}
export const plugins = [
  "gatsby-plugin-typescript",
  {
    resolve: "gatsby-plugin-graphql-codegen",
    options: {
      documentPaths: ["./src/**/*.{ts,tsx}"],
    },
  },
  "gatsby-plugin-styled-components",
  {
    resolve: "gatsby-plugin-google-fonts",
    options: {
      fonts: ["lato:400,700"],
      display: "swap",
    },
  },
  {
    resolve: "gatsby-plugin-manifest",
    options: {
      name: siteMetadata.title,
      short_name: "Geoffrey Challen",
      start_url: "/",
    },
  },
]
