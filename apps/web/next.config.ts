import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Firebase Hosting compatibility: add trailing slash
  trailingSlash: true,

  // 画像最適化（Static Exportでは制限あり）
  images: {
    unoptimized: true,
  },

  // gzip圧縮を有効化
  compress: true,

  // 本番環境でソースマップを無効化（ビルドサイズ削減）
  productionBrowserSourceMaps: false,

  // 実験的機能: さらなる最適化
  experimental: {
    // 使用されていないコードを削除
    optimizePackageImports: ["@firebase/app", "@firebase/auth", "@firebase/firestore", "@firebase/storage"],
  },
};

export default nextConfig;
