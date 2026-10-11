import type { NextConfig } from "next";

/** The rooms of the first version, retired: old links land on the one page. */
const RETIRED = ["/v2", "/groove", "/connect", "/practice", "/modes", "/listen", "/piano"];

const nextConfig: NextConfig = {
  async redirects() {
    return RETIRED.map((source) => ({ source, destination: "/", permanent: false }));
  },
};

export default nextConfig;
