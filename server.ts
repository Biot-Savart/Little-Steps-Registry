import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch metadata from a URL
  app.get("/api/metadata", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 5000
      });

      const $ = cheerio.load(response.data);
      const images: string[] = [];
      
      // Helper to clean and resolve URLs
      const resolveUrl = (src: string) => {
        if (!src) return null;
        if (src.startsWith('data:')) return null; // Skip base64 for now
        if (src.startsWith('//')) return 'https:' + src;
        if (!src.startsWith('http')) {
          try {
            const urlObj = new URL(url);
            return urlObj.origin + (src.startsWith('/') ? '' : '/') + src;
          } catch (e) {
            return null;
          }
        }
        return src;
      };

      // 1. Open Graph image (usually the best one)
      const ogImage = resolveUrl($('meta[property="og:image"]').attr('content') || 
                                 $('meta[name="twitter:image"]').attr('content'));
      if (ogImage) images.push(ogImage);

      // 2. Collect all other images
      $('img').each((i, el) => {
        const src = $(el).attr('src');
        const resolved = resolveUrl(src || '');
        if (resolved && !images.includes(resolved)) {
          // Basic filtering: skip tiny icons/trackers if possible
          // In a real scraper we'd check dimensions, but here we just collect
          images.push(resolved);
        }
      });

      // Limit to top 15 images to avoid overwhelming the UI
      res.json({ images: images.slice(0, 15) });
    } catch (error) {
      console.error("Error fetching metadata:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
