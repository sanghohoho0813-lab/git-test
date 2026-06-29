import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 독립앱: 서버/DB 없음. 정적 SPA 로 빌드되어 Vercel 등에 그대로 배포 가능.
export default defineConfig({
  plugins: [react()],
});
